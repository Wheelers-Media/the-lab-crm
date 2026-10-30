import { X } from "lucide-react";
import { useState } from "react";

const KEY = "labPhoneDesktopNoticeDismissed";

const isPhone = () =>
  window.matchMedia("(pointer: coarse)").matches &&
  Math.min(window.screen.width, window.screen.height) < 600;

/**
 * Shown only on the desktop layout when the device is a phone. That happens
 * when the browser's "Desktop site" setting is on (it asks for a 980px page,
 * so the phone layout never applies). Says so, and what to switch off, along
 * with the sizes measured so a wrong guess is easy to spot.
 */
export const PhoneDesktopNotice = () => {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  if (dismissed || !isPhone()) return null;
  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-lg border border-[var(--lab-amber)]/50 bg-card p-3 text-sm"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          This phone is showing the desktop version
        </p>
        <p className="text-muted-foreground">
          In Chrome, tap the three dots and turn off “Desktop site”, then open
          the app again.
        </p>
        <p className="mt-1 text-xs text-muted-foreground lab-num">
          Page {window.innerWidth}×{window.innerHeight} · screen{" "}
          {window.screen.width}×{window.screen.height}
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-muted"
        onClick={() => {
          try {
            sessionStorage.setItem(KEY, "1");
          } catch {
            /* storage unavailable */
          }
          setDismissed(true);
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
};
