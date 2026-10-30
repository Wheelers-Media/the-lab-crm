// Sends a CRM alert to every phone and computer that switched them on (Web
// Push). Never throws: an alert that cannot be sent must not break the lead,
// booking or payment it is about. Until VAPID_PRIVATE_KEY is set as a function
// secret it does nothing.
import { supabaseAdmin } from "../supabaseAdmin.ts";
import { type PushMessage, wantsKind } from "./pushMessages.ts";

/** The public half of the signing key. The browser needs the same value (src/components/atomic-crm/notifications/vapid.ts). */
export const VAPID_PUBLIC_KEY =
  "BDFlaQ3hZOGyTFx10yq6d9ZsPHUh5izj-YROSGb1rZPOgSKaZ2STG6Uv4PYcVm0Hb1Et6Tw3R52fQ5RdryiNUgM";

const SEND_BUDGET_MS = 6000;

type Subscription = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  prefs: unknown;
};

export const notify = async (message: PushMessage): Promise<void> => {
  try {
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!privateKey) return;

    const { data, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, prefs, sales!inner(disabled)")
      .eq("sales.disabled", false);
    if (error) throw new Error(error.message);
    const targets = ((data ?? []) as Subscription[]).filter((s) =>
      wantsKind(s.prefs, message.kind),
    );
    if (!targets.length) return;

    // Loaded here so a problem with the library can only ever cost the alert
    const { default: webpush } = await import("npm:web-push@3.6.7");
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") ?? "mailto:info@luxxautomotiveboutique.com",
      VAPID_PUBLIC_KEY,
      privateKey,
    );
    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      url: message.url,
      tag: message.tag,
    });

    const sendAll = Promise.allSettled(
      targets.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 3600, urgency: "high" },
          );
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ last_sent_at: new Date().toISOString() })
            .eq("id", s.id);
        } catch (e) {
          // 404 and 410 mean the phone removed the app or the permission
          const status = (e as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            await supabaseAdmin
              .from("push_subscriptions")
              .delete()
              .eq("id", s.id);
          } else {
            console.error("push send failed", status ?? e);
          }
        }
      }),
    );
    await Promise.race([
      sendAll,
      new Promise((resolve) => setTimeout(resolve, SEND_BUDGET_MS)),
    ]);
  } catch (e) {
    console.error("push failed", e instanceof Error ? e.message : e);
  }
};
