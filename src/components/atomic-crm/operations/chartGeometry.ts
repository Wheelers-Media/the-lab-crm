// Path maths for the hand-drawn SVG charts: smooth curves that pass through
// every point without overshooting it. A plain cubic spline bulges past its
// points, which on a running total draws a dip that never happened; a
// monotone curve (Fritsch-Carlson, the same rule as d3's curveMonotoneX)
// only bends between points, so the line stays honest while looking smooth.

export type Point = readonly [x: number, y: number];

const sign = (n: number): number => (n > 0 ? 1 : n < 0 ? -1 : 0);

/** The tangent at each point, limited so the curve never overshoots. */
const tangents = (points: readonly Point[]): number[] => {
  const n = points.length;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1][0] - points[i][0];
    slopes.push(dx ? (points[i + 1][1] - points[i][1]) / dx : 0);
  }
  return points.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === n - 1) return slopes[n - 2];
    const before = slopes[i - 1];
    const after = slopes[i];
    // A peak, a trough or a flat step: lie flat there
    if (before * after <= 0) return 0;
    const h0 = points[i][0] - points[i - 1][0];
    const h1 = points[i + 1][0] - points[i][0];
    const blended = (before * h1 + after * h0) / (h0 + h1);
    return (
      (sign(before) + sign(after)) *
      Math.min(Math.abs(before), Math.abs(after), 0.5 * Math.abs(blended))
    );
  });
};

const fmt = (n: number): string => (Math.round(n * 100) / 100).toString();

/**
 * "M x,y C ..." through every point. With `continued` the path starts with an
 * "L" instead of an "M", to carry on from a path already drawn (an area's
 * lower edge, say).
 */
export const smoothPath = (
  points: readonly Point[],
  { continued = false }: { continued?: boolean } = {},
): string => {
  if (!points.length) return "";
  const [x0, y0] = points[0];
  const start = `${continued ? "L" : "M"}${fmt(x0)},${fmt(y0)}`;
  if (points.length === 1) return start;
  if (points.length === 2) {
    return `${start} L${fmt(points[1][0])},${fmt(points[1][1])}`;
  }
  const t = tangents(points);
  let d = start;
  for (let i = 0; i < points.length - 1; i++) {
    const [xa, ya] = points[i];
    const [xb, yb] = points[i + 1];
    const third = (xb - xa) / 3;
    d +=
      ` C${fmt(xa + third)},${fmt(ya + t[i] * third)}` +
      ` ${fmt(xb - third)},${fmt(yb - t[i + 1] * third)}` +
      ` ${fmt(xb)},${fmt(yb)}`;
  }
  return d;
};

/**
 * A closed band between an upper and a lower curve over the same x values:
 * one layer of a stacked area. The lower edge is walked backwards so the
 * shape closes on itself.
 */
export const smoothBand = (
  upper: readonly Point[],
  lower: readonly Point[],
): string => {
  if (!upper.length) return "";
  const back = [...lower].reverse();
  return `${smoothPath(upper)} ${smoothPath(back, { continued: true })} Z`;
};
