import { useEffect, useRef } from "react";

/**
 * The website's header behaviour (chrome.js), ported one to one:
 *  - `--header-h` always equals the bar's real height, so anchors and focus land below it;
 *  - on phones the bar slides away on the way down and returns on the way up;
 *  - it stays put near the top (under 120px), while it holds focus, and for reduced motion.
 * The slide itself is CSS: the `.is-away` class on a `.lab-away` bar.
 */
export const useHeaderAway = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);

  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;

    const root = document.documentElement;
    const setHeight = () =>
      root.style.setProperty("--header-h", `${bar.offsetHeight}px`);
    setHeight();
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(setHeight)
        : null;
    resizeObserver?.observe(bar);

    const phone = window.matchMedia("(max-width: 767px)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lastY = window.scrollY;
    let pending = false;

    const settle = () => {
      pending = false;
      const y = window.scrollY;
      const dy = y - lastY;
      const pinned =
        !phone.matches ||
        calm.matches ||
        y < 120 ||
        bar.contains(document.activeElement);
      if (pinned) bar.classList.remove("is-away");
      else if (dy > 6) bar.classList.add("is-away");
      else if (dy < -6) bar.classList.remove("is-away");
      if (Math.abs(dy) > 6 || pinned) lastY = y;
    };
    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(settle);
    };
    const onFocusIn = () => bar.classList.remove("is-away");

    window.addEventListener("scroll", onScroll, { passive: true });
    bar.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("scroll", onScroll);
      bar.removeEventListener("focusin", onFocusIn);
      resizeObserver?.disconnect();
    };
  }, []);

  return ref;
};
