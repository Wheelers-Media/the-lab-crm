import { useCallback, useState } from "react";

import { getSupabaseClient } from "../providers/supabase/supabase";

export type TestAlertState = "idle" | "sending" | "sent" | "failed";

// The push service answers 401 or 403 when the signing key in Supabase does
// not match the public key the app subscribed with
const KEY_MISMATCH = new Set([401, 403]);

const failureMessage = (status: number | null): string =>
  status != null && KEY_MISMATCH.has(status)
    ? "The push service refused the shop's signing key. VAPID_PRIVATE_KEY in Supabase does not match the key in the app."
    : `The push service did not accept the alert${status ? ` (error ${status})` : ""}. Try again in a minute.`;

/** Sends one alert to this device through the server, the way real alerts go out. */
export const useTestAlert = () => {
  const [state, setState] = useState<TestAlertState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const send = useCallback(async () => {
    setState("sending");
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) throw new Error("Alerts are not on for this device.");

      const { data, error } = await getSupabaseClient().functions.invoke<{
        ok: boolean;
        status: number | null;
      }>("push_test", {
        method: "POST",
        body: { endpoint: subscription.endpoint },
      });
      if (error) {
        const detail = await (
          error as { context?: { json?: () => Promise<{ message?: string }> } }
        ).context
          ?.json?.()
          .catch(() => null);
        throw new Error(detail?.message ?? error.message);
      }
      if (!data?.ok) throw new Error(failureMessage(data?.status ?? null));

      setState("sent");
      setMessage(
        "Test sent. It should pop up on this device in a few seconds.",
      );
    } catch (e) {
      setState("failed");
      setMessage(
        `Could not send the test. ${e instanceof Error ? e.message : ""}`.trim(),
      );
    }
  }, []);

  return { state, message, send };
};
