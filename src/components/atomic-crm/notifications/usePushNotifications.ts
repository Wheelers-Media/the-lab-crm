import { useGetIdentity } from "ra-core";
import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "../providers/supabase/supabase";
import { urlBase64ToBytes, VAPID_PUBLIC_KEY } from "./vapid";

export type PushKind = "lead" | "booking" | "deposit" | "order";
export type PushPrefs = Partial<Record<PushKind, boolean>>;

/**
 * unsupported: this browser, or the demo, cannot do alerts.
 * blocked: the phone's settings forbid them for this app.
 */
export type PushState = "loading" | "unsupported" | "blocked" | "off" | "on";

const supported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window &&
  Boolean(import.meta.env.VITE_SUPABASE_URL);

const table = () => getSupabaseClient().from("push_subscriptions");

/** Alerts on this device: turn them on or off, and choose which kinds. */
export const usePushNotifications = () => {
  const { identity } = useGetIdentity();
  const [state, setState] = useState<PushState>("loading");
  const [prefs, setPrefs] = useState<PushPrefs>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supported()) return setState("unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (cancelled) return;
      if (!subscription) return setState("off");
      setState("on");
      const { data } = await table()
        .select("prefs")
        .eq("endpoint", subscription.endpoint)
        .maybeSingle();
      if (!cancelled && data?.prefs) setPrefs(data.prefs as PushPrefs);
    })().catch(() => {
      if (!cancelled) setState("off");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      if (identity?.id == null) throw new Error("Not signed in yet");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(
            VAPID_PUBLIC_KEY,
          ) as BufferSource,
        }));
      const keys = subscription.toJSON().keys;
      if (!keys?.p256dh || !keys.auth) throw new Error("No push keys");
      const { error: saveError } = await table().upsert(
        {
          sales_id: identity.id,
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          prefs,
          user_agent: navigator.userAgent.slice(0, 200),
        },
        { onConflict: "endpoint" },
      );
      if (saveError) throw new Error(saveError.message);
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn on alerts");
    } finally {
      setBusy(false);
    }
  }, [identity?.id, prefs]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await table().delete().eq("endpoint", subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn off alerts");
    } finally {
      setBusy(false);
    }
  }, []);

  const setKind = useCallback(
    async (kind: PushKind, on: boolean) => {
      const next = { ...prefs, [kind]: on };
      setPrefs(next);
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) return;
      const { error: saveError } = await table()
        .update({ prefs: next })
        .eq("endpoint", subscription.endpoint);
      if (saveError) {
        setPrefs(prefs);
        setError(saveError.message);
      }
    },
    [prefs],
  );

  return { state, prefs, error, busy, enable, disable, setKind };
};
