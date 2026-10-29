import { useMutation } from "@tanstack/react-query";
import { Copy, RefreshCw } from "lucide-react";
import { useDataProvider, useNotify } from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { KpiTile } from "../operations/OperationsWidgets";
import {
  formatShopDay,
  formatShopTime,
  shopDayKey,
} from "../operations/shopTime";
import { SearchConsoleSyncError } from "../providers/commons/searchConsoleSync";
import type { CrmDataProvider } from "../providers/types";
import type { NumbersRanges } from "./periods";
import {
  newestSearchSync,
  pagePath,
  SEARCH_METRICS,
  searchChange,
  type SearchDayRow,
  type SearchGroup,
  searchGroups,
  type SearchMetric,
  type SearchPageRow,
  type SearchQueryRow,
  searchTotals,
  searchTrend,
} from "./searchModel";
import { TrendChart } from "./TrendChart";
import { useAllRecords } from "./useAllRecords";
import type { Column } from "./widgets";
import { SectionCard, StatTable } from "./widgets";

// Google updates once a day, a couple of days behind: a few hours is fresh
const STALE_MS = 6 * 60 * 60 * 1000;

const count = (n: number) => n.toLocaleString("en-CA");
const spot = (n: number) => (n ? n.toFixed(1) : "—");

const groupColumns = (label: string): Array<Column<SearchGroup>> => [
  { header: label, value: (r) => r.label },
  { header: "Clicks", value: (r) => r.clicks, numeric: true },
  { header: "Times shown", value: (r) => r.impressions, numeric: true },
  {
    header: "Click rate",
    value: (r) => r.ctr,
    display: (r) => `${r.ctr}%`,
    numeric: true,
  },
  {
    header: "Average spot",
    value: (r) => r.position,
    display: (r) => spot(r.position),
    numeric: true,
  },
];

/** What to do when Search Console is not reachable yet, in the shop's words. */
const Setup = ({ error }: { error: SearchConsoleSyncError }) => {
  const notify = useNotify();
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify("Email copied", { type: "info" });
    } catch {
      notify("Could not copy. Select the email instead.", { type: "warning" });
    }
  };
  if (error.code === "needs_access" && error.email) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p>
          Google has the numbers; it just has not shared them with the CRM yet.
          Whoever looks after the website in Google Search Console does this
          once:
        </p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>
            Open{" "}
            <a
              href="https://search.google.com/search-console/users"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Search Console, Settings, Users and permissions
            </a>{" "}
            for thelabfsj.ca.
          </li>
          <li>
            Add user, paste this email, and give it Restricted permission:
            <span className="mt-1.5 flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-muted px-2 py-1 text-xs">
                {error.email}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copy(error.email!)}
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
            </span>
          </li>
          <li>Come back and press Update.</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          If the website is not in Search Console yet, add it there first
          (Google walks through proving you own it). Numbers start the day it is
          added.
        </p>
      </div>
    );
  }
  return (
    <p className="text-sm text-muted-foreground" role="alert">
      {error.message}
    </p>
  );
};

/**
 * How the website does in Google search, from Search Console (copied into the
 * CRM by the search_console_sync function): how often it shows, how often
 * people click, for which searches and to which pages.
 */
export const SearchSection = ({
  ranges,
  vs,
}: {
  ranges: NumbersRanges;
  vs: string;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [metric, setMetric] = useState<SearchMetric>("clicks");
  const since = shopDayKey(ranges.previous.start);
  const from = shopDayKey(ranges.current.start);
  const daily = useAllRecords<SearchDayRow>("search_console_daily", {
    filter: { "day@gte": since },
    sort: { field: "day", order: "ASC" },
  });
  const queries = useAllRecords<SearchQueryRow>("search_console_queries", {
    filter: { "day@gte": from },
    sort: { field: "day", order: "ASC" },
  });
  const pages = useAllRecords<SearchPageRow>("search_console_pages", {
    filter: { "day@gte": from },
    sort: { field: "day", order: "ASC" },
  });
  const rows = useMemo(() => daily.data ?? [], [daily.data]);

  const sync = useMutation({
    mutationFn: () => dataProvider.syncSearchConsole(),
    onSuccess: () => {
      void daily.refetch();
      void queries.refetch();
      void pages.refetch();
    },
  });
  const { mutate: syncNow } = sync;
  const syncedAt = useMemo(() => newestSearchSync(rows), [rows]);

  // Bring the copy up to date once per visit when it is missing or old. A
  // failed try is shown below instead of being retried in a loop.
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (tried || daily.isPending || daily.error) return;
    const stale = !syncedAt || Date.now() - Date.parse(syncedAt) > STALE_MS;
    if (!stale) return;
    setTried(true);
    syncNow();
  }, [tried, daily.isPending, daily.error, syncedAt, syncNow]);

  const c = useMemo(() => searchTotals(rows, ranges.current), [rows, ranges]);
  const p = useMemo(() => searchTotals(rows, ranges.previous), [rows, ranges]);
  const points = useMemo(
    () => searchTrend(rows, ranges, metric),
    [rows, ranges, metric],
  );
  const topQueries = useMemo(
    () => searchGroups(queries.data ?? [], ranges.current, (r) => r.query),
    [queries.data, ranges],
  );
  const topPages = useMemo(
    () =>
      searchGroups(pages.data ?? [], ranges.current, (r) => pagePath(r.page)),
    [pages.data, ranges],
  );
  const meta = SEARCH_METRICS.find((m) => m.value === metric)!;

  const updated = syncedAt
    ? `${formatShopDay(shopDayKey(syncedAt), { month: "short", day: "numeric" })}, ${formatShopTime(syncedAt)}`
    : null;
  const setupError =
    sync.error instanceof SearchConsoleSyncError ? sync.error : null;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold">Google search</h2>
        <p className="text-xs text-muted-foreground">
          From Google Search Console, about two days behind.{" "}
          {updated ? `Updated ${updated}` : "Not copied from Google yet"}
        </p>
      </div>
      {daily.error ? null : (
        <Button
          variant="outline"
          size="sm"
          disabled={sync.isPending}
          onClick={() => syncNow()}
        >
          <RefreshCw
            className={sync.isPending ? "size-4 animate-spin" : "size-4"}
          />
          Update
        </Button>
      )}
    </div>
  );

  if (daily.error) {
    return (
      <>
        {header}
        <p className="text-sm text-destructive">
          Could not load Google search. If this version was only just released,
          the database update for it may not have gone out yet.
        </p>
      </>
    );
  }
  if (daily.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <>
      {header}
      {setupError ? (
        <SectionCard title="Connect Google Search Console">
          <Setup error={setupError} />
        </SectionCard>
      ) : sync.error ? (
        <p className="text-sm text-destructive" role="alert">
          {sync.error.message}
        </p>
      ) : null}
      {!rows.length ? (
        setupError ? null : (
          <p className="text-sm text-muted-foreground">
            {sync.isPending
              ? "Copying from Google. The first time brings in the last 16 months, so it takes a moment."
              : "Nothing copied from Google yet. Press Update."}
          </p>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiTile
              label="Clicks from Google"
              value={count(c.clicks)}
              trend={searchChange("clicks", c, p)}
              detail={vs}
              onSelect={() => setMetric("clicks")}
              selected={metric === "clicks"}
            />
            <KpiTile
              label="Times shown"
              value={count(c.impressions)}
              trend={searchChange("impressions", c, p)}
              detail="in someone's results"
              onSelect={() => setMetric("impressions")}
              selected={metric === "impressions"}
            />
            <KpiTile
              label="Click rate"
              value={`${c.ctr}%`}
              detail={`was ${p.ctr}%`}
              onSelect={() => setMetric("ctr")}
              selected={metric === "ctr"}
            />
            <KpiTile
              label="Average spot"
              value={spot(c.position)}
              trend={searchChange("position", c, p)}
              detail={`1 is the top · was ${spot(p.position)}`}
              onSelect={() => setMetric("position")}
              selected={metric === "position"}
            />
          </div>

          <SectionCard
            title={`${meta.label} over time`}
            hint={`${meta.hint}. Bars are this period; the line across each bar is the same stretch before.`}
          >
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={metric}
              onValueChange={(v) => v && setMetric(v as SearchMetric)}
              aria-label="Google search chart figure"
              className="lab-scroll-x self-start"
            >
              {SEARCH_METRICS.map((m) => (
                <ToggleGroupItem
                  key={m.value}
                  value={m.value}
                  className="px-3 min-h-9"
                >
                  {m.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <TrendChart
              points={points}
              isMoney={false}
              percent={metric === "ctr"}
              label={meta.label}
              clickHint=""
            />
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <SectionCard
              title="What people searched"
              hint="Searches the website showed up for. One shown often with few clicks is a page worth improving."
            >
              <StatTable
                rows={topQueries}
                columns={groupColumns("Search")}
                rowKey={(r) => r.label}
                filename="google-searches"
                empty="No searches in this period. Google holds back very rare ones."
              />
            </SectionCard>
            <SectionCard
              title="Pages found in Google"
              hint="Which pages of the website Google showed, and how often people clicked them."
            >
              <StatTable
                rows={topPages}
                columns={groupColumns("Page")}
                rowKey={(r) => r.label}
                filename="google-pages"
                empty="No pages in this period."
              />
            </SectionCard>
          </div>
        </>
      )}
    </>
  );
};
