import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";

const STORAGE_KEY = "lab.scroll";
// How long to wait for a page's data to render tall enough to scroll back to
const RESTORE_TIMEOUT_MS = 1500;

const readPositions = (): Record<string, number> => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
};

const savePosition = (key: string, y: number) => {
  try {
    const positions = readPositions();
    positions[key] = Math.round(y);
    // Keep the newest 50 pages so the store stays small
    const entries = Object.entries(positions).slice(-50);
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(entries)),
    );
  } catch {
    // Private mode or a full store: going back simply starts at the top
  }
};

const isDialogOpen = () =>
  Boolean(document.querySelector('[role="dialog"][data-state="open"]'));

/**
 * Remembers where you were on every page. Going back returns to the same
 * spot once the list has rendered; opening a new page starts at the top,
 * except for pages that open as a dialog over the current one.
 */
export const ScrollMemory = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const dialogBefore = useRef(false);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  }, []);

  // Save the position of the page being viewed as it scrolls
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!isDialogOpen()) savePosition(location.key, window.scrollY);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [location.key]);

  useLayoutEffect(() => {
    const dialogNow = isDialogOpen();
    const overlay = dialogNow || dialogBefore.current;
    dialogBefore.current = dialogNow;
    if (overlay) return;

    if (navigationType !== "POP") {
      // ra-core marks in-place navigations (a job card opening its dialog)
      const keepPlace =
        (location.state as { _scrollToTop?: boolean } | null)?._scrollToTop ===
        false;
      if (navigationType === "PUSH" && !keepPlace) window.scrollTo(0, 0);
      return;
    }

    const target = readPositions()[location.key];
    if (!target) return;
    let frame = 0;
    let cancelled = false;
    const started = performance.now();
    const stop = () => {
      cancelled = true;
    };
    // A touch or wheel means the user took over; do not pull the page back
    window.addEventListener("wheel", stop, { once: true, passive: true });
    window.addEventListener("touchstart", stop, { once: true, passive: true });
    const attempt = () => {
      if (cancelled) return;
      const room = document.documentElement.scrollHeight - window.innerHeight;
      if (room >= target || performance.now() - started > RESTORE_TIMEOUT_MS) {
        window.scrollTo(0, Math.min(target, Math.max(room, 0)));
        return;
      }
      frame = requestAnimationFrame(attempt);
    };
    attempt();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
    };
  }, [location.key, location.state, navigationType]);

  return null;
};
