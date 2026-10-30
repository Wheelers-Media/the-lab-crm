import { X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  isPhoneInDesktopMode,
  phoneWidth,
  readDisplay,
} from "./phoneDesktopMode";

const KEY = "labPhoneDesktopNoticeDismissed";

/**
 * Shown on the desktop layout when the device is a phone. That happens when the
 * browser's "Desktop site" setting is on: it asks for a 980px page and shrinks
 * it to fit, so the phone layout never applies. It first tries to ask the
 * browser for the phone's real width; if the browser ignores that, this says
 * what to switch off, with the readings so a wrong guess is easy to spot.
 */
export const PhoneDesktopNotice = () => {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  const display = readDisplay();
  const phone = isPhoneInDesktopMode(display);

  useEffect(() => {
    if (!phone) return;
    // Some browsers honour a changed viewport tag even in desktop mode; if this
    // one does, the page re-lays out at phone width and the phone layout takes over
    const meta = document.querySelector('meta[name="viewport"]');
    meta?.setAttribute(
      "content",
      `width=${phoneWidth(display)}, initial-scale=1, viewport-fit=cover`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  if (dismissed || !phone) return null;
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
          Tap the three dots, turn off “Desktop site”, and open the app again.
          If this is the installed app, tap the three dots, choose “Open in
          Chrome”, and turn it off there.
        </p>
        <p className="mt-1 text-xs text-muted-foreground lab-num">
          Page {display.innerWidth} · screen {display.screenWidth}×
          {display.screenHeight} · zoom {display.scale.toFixed(2)} · touch{" "}
          {display.maxTouchPoints}
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
