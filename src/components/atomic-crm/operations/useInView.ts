import { useEffect, useState } from "react";

const reducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * True once the element has scrolled into view, and from then on, so a chart
 * draws itself in as you reach it rather than while it is still off screen.
 * Anyone who has asked for less motion, or a browser without the observer,
 * gets `true` straight away: the chart is simply there.
 *
 * Returns a callback ref rather than a ref object, so watching starts
 * whenever the element appears: a chart often mounts after its data loads,
 * well after the first render.
 */
export const useInView = <T extends Element>(
  threshold = 0.2,
): [(element: T | null) => void, boolean] => {
  const [element, setElement] = useState<T | null>(null);
  const [inView, setInView] = useState(
    () => typeof IntersectionObserver === "undefined" || reducedMotion(),
  );

  useEffect(() => {
    if (inView || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, inView, threshold]);

  return [setElement, inView];
};
