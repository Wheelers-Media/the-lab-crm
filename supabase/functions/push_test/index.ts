// "Send a test alert" in Settings > Notifications: sends one alert to the
// signed-in person's own device, the same way real alerts go out, and says
// whether the push service accepted it. Nothing else receives it.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { sendPush, type Subscription } from "../_shared/lab/push.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        if (req.method !== "POST")
          return createErrorResponse(405, "Method not allowed");
        if (!user) return createErrorResponse(401, "Unauthorized");

        const body = await req.json().catch(() => ({}));
        const endpoint =
          typeof body?.endpoint === "string" ? body.endpoint : null;
        if (!endpoint) return createErrorResponse(400, "Missing endpoint");

        const sale = await getUserSale(user);
        if (!sale)
          return createErrorResponse(403, "No CRM user for this login");

        // Only this person's own device, and only the one that asked
        const { data, error } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth, prefs")
          .eq("sales_id", sale.id)
          .eq("endpoint", endpoint);
        if (error) return createErrorResponse(500, error.message);
        if (!data?.length)
          return createErrorResponse(404, "Alerts are not on for this device");

        try {
          const [result] = await sendPush(data as Subscription[], {
            title: "THE LAB CRM",
            body: "Test alert: alerts are working on this device.",
            url: "/#/settings",
            tag: "test",
          });
          return json({ ok: result.ok, status: result.status ?? null });
        } catch (e) {
          return createErrorResponse(
            500,
            e instanceof Error ? e.message : "Send failed",
          );
        }
      }),
    ),
  ),
);
