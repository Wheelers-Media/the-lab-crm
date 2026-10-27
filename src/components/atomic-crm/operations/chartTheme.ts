import { useEffect, useState } from "react";

/**
 * Chart colours, read from the CSS tokens so the light and dark schemes stay in
 * step. Nivo wants colour strings rather than custom properties, so the values
 * are resolved here and re-read when the theme class on <html> changes.
 */
export interface ChartPalette {
  /** This period, and the primary series. */
  thisPeriod: string;
  /** The period before, and other "behind" context. */
  compare: string;
  /** Not yet won or lost: pending, reserved, planned. */
  pending: string;
  /** The selected bar. */
  selected: string;
  /** Losses and refunds. */
  lost: string;
}

const TOKENS: Record<keyof ChartPalette, string> = {
  thisPeriod: "--chart-this",
  compare: "--chart-compare",
  pending: "--chart-pending",
  selected: "--chart-selected",
  lost: "--chart-lost",
};

/** Used when the stylesheet is not available, as in a unit test. */
const FALLBACKS: ChartPalette = {
  thisPeriod: "#0066ff",
  compare: "#6b7686",
  pending: "#cfe3ff",
  selected: "#5c9dff",
  lost: "#e5484d",
};

const read = (token: string, fallback: string): string => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value || fallback;
};

export const chartPalette = (): ChartPalette => ({
  thisPeriod: read(TOKENS.thisPeriod, FALLBACKS.thisPeriod),
  compare: read(TOKENS.compare, FALLBACKS.compare),
  pending: read(TOKENS.pending, FALLBACKS.pending),
  selected: read(TOKENS.selected, FALLBACKS.selected),
  lost: read(TOKENS.lost, FALLBACKS.lost),
});

/** The palette for the scheme in use, kept current as the reader switches it. */
export const useChartPalette = (): ChartPalette => {
  const [palette, setPalette] = useState<ChartPalette>(chartPalette);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setPalette(chartPalette());
    update();
    // The theme provider flips a class on <html>; nothing else moves the tokens
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return palette;
};

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const prefersReduced = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(REDUCED_MOTION).matches;

/** True while the reader has asked their system for less motion. */
export const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(prefersReduced);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(REDUCED_MOTION);
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
};
