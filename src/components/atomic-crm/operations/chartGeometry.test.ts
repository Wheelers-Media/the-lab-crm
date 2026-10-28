import { describe, expect, it } from "vitest";

import { smoothBand, smoothPath } from "./chartGeometry";

/** The y values a cubic Bezier segment reaches, sampled along it. */
const sampleSegments = (d: string): number[] => {
  const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const ys: number[] = [];
  let py = nums[1];
  for (let i = 2; i + 5 < nums.length + 1; i += 6) {
    const [, c1y, , c2y, , y] = nums.slice(i, i + 6);
    for (let t = 0; t <= 1; t += 0.05) {
      const u = 1 - t;
      ys.push(
        u * u * u * py +
          3 * u * u * t * c1y +
          3 * u * t * t * c2y +
          t * t * t * y,
      );
    }
    py = y;
  }
  return ys;
};

describe("smoothPath", () => {
  it("passes through every point", () => {
    const points = [
      [0, 10],
      [10, 30],
      [20, 25],
      [30, 40],
    ] as const;
    const d = smoothPath(points);
    for (const [x, y] of points) {
      expect(d).toContain(`${x},${y}`);
    }
    expect(d.startsWith("M0,10")).toBe(true);
  });

  it("never dips below a flat stretch of a running total", () => {
    // Arrange: a running total that rises, holds flat, then rises again
    const points = [
      [0, 0],
      [10, 50],
      [20, 50],
      [30, 50],
      [40, 90],
    ] as const;

    // Act
    const ys = sampleSegments(smoothPath(points));

    // Assert: the curve stays inside the values it passes through
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(90);
  });

  it("falls back to straight lines for one or two points", () => {
    expect(smoothPath([[5, 5]])).toBe("M5,5");
    expect(
      smoothPath([
        [0, 0],
        [10, 20],
      ]),
    ).toBe("M0,0 L10,20");
    expect(smoothPath([])).toBe("");
  });
});

describe("smoothBand", () => {
  it("closes the upper curve back along the lower one", () => {
    const d = smoothBand(
      [
        [0, 10],
        [10, 5],
        [20, 8],
      ],
      [
        [0, 20],
        [10, 20],
        [20, 20],
      ],
    );
    expect(d.startsWith("M0,10")).toBe(true);
    expect(d).toContain("L20,20");
    expect(d.endsWith("Z")).toBe(true);
  });
});
