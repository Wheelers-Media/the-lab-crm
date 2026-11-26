import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router";

const STORAGE_KEY = "lab.scroll";
// How long to wait for a page's data to render tall enough to scroll back to
const RESTORE_TIMEOUT_MS = 5000;
// Reopening the app within this long lands on the page it was left on
const RESUME_WINDOW_MS = 6 * 3_600_000;
const LAST_KEY = "lab.last";
const INNER_KEY = "lab.scroll.inner";

interface LastPlace {
  path: string;
  y: number;
  at: number;
}

const readLast = (): LastPlace | null => {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) ?? "null");
  } catch {
    return null;
  }
};

const writeLast = (place: LastPlace) => {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(place));
  } catch {
    // Not remembered; the app simply opens on Home
  }
};

const readInner = (): Record<string, [number, number]> => {
  try {
    return JSON.parse(sessionStorage.getItem(INNER_KEY) ?? "{}");
  } catch {
    return {};
  }
};

// True once this page load has had its chance to resume the last place
let booted = false;

/** Scrolls to y as soon as the page is tall enough, giving up after a while or when the user scrolls. */
const scrollWhenTall = (target: number): (() => void) => {
  let frame = 0;
  let cancelled = false;
  const started = performance.now();
  const stop = () => {
    cancelled = true;
  };
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
};

/** Puts every marked inner scroller (the job board, tab rows) back where it was. */
const restoreInner = (pageKey: string): (() => void) => {
  const saved = readInner();
  let frame = 0;
  const started = performance.now();
  const attempt = () => {
    const pending = Object.entries(saved).filter(([k]) =>
      k.startsWith(`${pageKey}::`),
    );
    let done = true;
    for (const [k, [left, top]] of pending) {
      const el = document.querySelector<HTMLElement>(
        `[data-scroll-key="${k.slice(pageKey.length + 2)}"]`,
      );
      if (!el) {
        done = false;
        continue;
      }
      el.scrollLeft = left;
      el.scrollTop = top;
      if (
        Math.abs(el.scrollLeft - left) > 2 ||
        Math.abs(el.scrollTop - top) > 2
      )
        done = false;
    }
    if (!done && performance.now() - started < RESTORE_TIMEOUT_MS) {
      frame = requestAnimationFrame(attempt);
    }
  };
  attempt();
  return () => cancelAnimationFrame(frame);
};

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
  const navigate = useNavigate();
  const dialogBefore = useRef(false);

  // Reopening the app: go back to the page it was left on, at the same spot
  useEffect(() => {
    if (booted) return;
    booted = true;
    const last = readLast();
    const here = `${location.pathname}${location.search}`;
    if (
      here === "/" &&
      navigationType === "POP" &&
      last &&
      last.path !== "/" &&
      Date.now() - last.at < RESUME_WINDOW_MS
    ) {
      navigate(last.path, { replace: true });
      scrollWhenTall(last.y);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember the page being viewed, for resuming and for inner scrollers
  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    writeLast({ path, y: Math.round(window.scrollY), at: Date.now() });
    const onInner = (event: Event) => {
      const el = event.target;
      if (!(el instanceof HTMLElement)) return;
      const name = el.dataset.scrollKey;
      if (!name) return;
      try {
        const all = readInner();
        all[`${location.key}::${name}`] = [
          Math.round(el.scrollLeft),
          Math.round(el.scrollTop),
        ];
        sessionStorage.setItem(
          INNER_KEY,
          JSON.stringify(Object.fromEntries(Object.entries(all).slice(-100))),
        );
      } catch {
        // Not remembered
      }
    };
    document.addEventListener("scroll", onInner, true);
    return () => document.removeEventListener("scroll", onInner, true);
  }, [location.key, location.pathname, location.search]);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  }, []);

  // Save the position of the page being viewed as it scrolls
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (isDialogOpen()) return;
        savePosition(location.key, window.scrollY);
        writeLast({
          path: `${location.pathname}${location.search}`,
          y: Math.round(window.scrollY),
          at: Date.now(),
        });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [location.key, location.pathname, location.search]);

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
    const stopInner = restoreInner(location.key);
    const stopOuter = target ? scrollWhenTall(target) : () => {};
    return () => {
      stopInner();
      stopOuter();
    };
  }, [location.key, location.state, navigationType]);

  return null;
};
