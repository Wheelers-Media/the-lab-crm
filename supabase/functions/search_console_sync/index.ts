// Copies the shop website's Google search performance from Search Console into
// the CRM, for the Google search part of Numbers: clicks, impressions and
// average position per day, and per day for each search phrase and page.
// Signed-in CRM users only.
//
// Uses the same Google service account as the calendar sync
// (GOOGLE_SERVICE_ACCOUNT_JSON). It reads Search Console once that account's
// email is added as a user on the site's Search Console property and the
// Search Console API is enabled in its Google Cloud project. Optional
// SEARCH_CONSOLE_SITE names the property ("sc-domain:thelabfsj.ca") when the
// account can see more than one for the shop.
//
// POST {} -> { site, days, queries, pages }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import {
  parseServiceAccount,
  type ServiceAccount,
  signedAssertion,
} from "../_shared/lab/googleCalendar.ts";
import {
  DAILY_HISTORY_DAYS,
  DETAIL_HISTORY_DAYS,
  PAGE_ROWS,
  parseDaily,
  parseDetail,
  pickSite,
  queryBody,
  SEARCH_CONSOLE_SCOPE,
  type SiteEntry,
  syncWindow,
} from "../_shared/lab/searchConsole.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";

const API = "https://searchconsole.googleapis.com/webmasters/v3";
const UPSERT_CHUNK = 500;
// A small site's detail fits in a page or two; this only stops a runaway loop
const MAX_PAGES = 8;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

/** A problem to show as is, with a code the CRM uses to say what to do. */
class SearchConsoleFailure extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;
  constructor(
    status: number,
    code: string,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const accessToken = async (account: ServiceAccount): Promise<string> => {
  const assertion = await signedAssertion(
    account,
    Math.floor(Date.now() / 1000),
    SEARCH_CONSOLE_SCOPE,
  );
  const res = await fetch(account.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new SearchConsoleFailure(
      502,
      "key_refused",
      `Google refused the service account key (${body.error_description ?? body.error ?? res.status}).`,
    );
  }
  return body.access_token as string;
};

const google = async (
  token: string,
  path: string,
  init: RequestInit = {},
  email = "",
): Promise<Record<string, unknown>> => {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  if (res.ok) return body as Record<string, unknown>;
  const message = body.error?.message ?? res.statusText;
  if (res.status === 403 && /has not been used|is disabled/i.test(message)) {
    throw new SearchConsoleFailure(
      403,
      "api_disabled",
      'The Search Console API is not turned on for the CRM\'s Google project yet. Turn on "Google Search Console API" in Google Cloud, then try again.',
      { email },
    );
  }
  throw new SearchConsoleFailure(
    res.status === 403 ? 403 : 502,
    res.status === 403 ? "needs_access" : "google_error",
    `Search Console: ${message}`,
    { email },
  );
};

const newestDay = async (table: string): Promise<string | null> => {
  const { data } = await supabaseAdmin
    .from(table)
    .select("day")
    .order("day", { ascending: false })
    .limit(1);
  return typeof data?.[0]?.day === "string" ? data[0].day : null;
};

const save = async (
  table: string,
  rows: Array<Record<string, unknown>>,
  onConflict: string,
  syncedAt: string,
) => {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error } = await supabaseAdmin.from(table).upsert(
      rows
        .slice(i, i + UPSERT_CHUNK)
        .map((row) => ({ ...row, synced_at: syncedAt })),
      { onConflict },
    );
    if (error) throw new Error(`save ${table}: ${error.message}`);
  }
};

const handle = async () => {
  const account = parseServiceAccount(
    Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON"),
  );
  if (!account) {
    throw new SearchConsoleFailure(
      503,
      "not_configured",
      "The CRM has no Google service account yet. It is the same one the calendar sync uses; see docs/google-calendar-setup.md.",
    );
  }
  const email = account.client_email;
  const token = await accessToken(account);

  const listed = await google(token, "/sites", {}, email);
  const sites = (listed.siteEntry ?? []) as SiteEntry[];
  const site = Deno.env.get("SEARCH_CONSOLE_SITE")?.trim() || pickSite(sites);
  if (!site) {
    throw new SearchConsoleFailure(
      403,
      "needs_access",
      "Search Console has not shared the shop's website with the CRM yet.",
      { email },
    );
  }
  const sitePath = `/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  const report = async (
    window: { startDate: string; endDate: string },
    dimensions: Array<"date" | "query" | "page">,
  ) => {
    const rows: unknown[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await google(
        token,
        sitePath,
        {
          method: "POST",
          body: JSON.stringify(queryBody(window, dimensions, page * PAGE_ROWS)),
        },
        email,
      );
      const got = Array.isArray(body.rows) ? body.rows : [];
      rows.push(...got);
      if (got.length < PAGE_ROWS) break;
    }
    return rows;
  };

  const now = new Date();
  const syncedAt = now.toISOString();
  const dailyWindow = syncWindow(
    await newestDay("search_console_daily"),
    now,
    DAILY_HISTORY_DAYS,
  );
  const queryWindow = syncWindow(
    await newestDay("search_console_queries"),
    now,
    DETAIL_HISTORY_DAYS,
  );
  const pageWindow = syncWindow(
    await newestDay("search_console_pages"),
    now,
    DETAIL_HISTORY_DAYS,
  );

  const [daily, queries, pages] = await Promise.all([
    report(dailyWindow, ["date"]).then(parseDaily),
    report(queryWindow, ["date", "query"]).then((r) => parseDetail(r, "query")),
    report(pageWindow, ["date", "page"]).then((r) => parseDetail(r, "page")),
  ]);

  await save("search_console_daily", daily, "day", syncedAt);
  await save("search_console_queries", queries, "day,query", syncedAt);
  await save("search_console_pages", pages, "day,page", syncedAt);
  // A day Google has nothing for still counts as copied, so an empty site
  // does not look unsynced forever
  if (!daily.length) {
    await save(
      "search_console_daily",
      [{ day: dailyWindow.endDate, clicks: 0, impressions: 0, position: 0 }],
      "day",
      syncedAt,
    );
  }

  return json({
    site,
    days: daily.length,
    queries: queries.length,
    pages: pages.length,
  });
};

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req) => {
        if (req.method !== "POST") {
          return createErrorResponse(405, "Method Not Allowed");
        }
        try {
          return await handle();
        } catch (error) {
          if (error instanceof SearchConsoleFailure) {
            return createErrorResponse(error.status, error.message, {
              code: error.code,
              ...error.extra,
            });
          }
          console.error("search_console_sync failed:", error);
          return createErrorResponse(
            500,
            `Could not update Google search: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    ),
  ),
);
