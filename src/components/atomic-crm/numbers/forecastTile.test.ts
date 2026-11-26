import { describe, expect, it } from "vitest";

import { tileForecast } from "./forecastTile";
import { numbersRanges } from "./periods";

const NOW = new Date("2026-11-11T19:00:00Z");
const money = (n: number) => `$${Math.round(n)}`;
const day = (at: string, n: number) => ({ at, n });

describe("tileForecast", () => {
  const ranges = numbersRanges("month", NOW);

  it("projects this month and sets it against last month's finish", () => {
    const items = [
      day("2026-11-03T18:00:00Z", 750),
      day("2026-11-09T18:00:00Z", 750),
      day("2026-10-15T18:00:00Z", 1000),
    ];
    const f = tileForecast(
      items,
      (i) => i.at,
      (i) => i.n,
      ranges,
      NOW,
      money,
    );
    expect(f?.text).toMatch(/^On pace for \$/);
    expect(f?.range).toContain("last month $1000");
    expect(f?.tone).toBe("good");
  });

  it("reads a rise as bad news when lower is better", () => {
    const items = [
      day("2026-11-03T18:00:00Z", 500),
      day("2026-10-15T18:00:00Z", 100),
    ];
    const f = tileForecast(
      items,
      (i) => i.at,
      (i) => i.n,
      ranges,
      NOW,
      money,
      "lower",
    );
    expect(f?.tone).toBe("bad");
  });

  it("makes no projection for other periods", () => {
    expect(
      tileForecast(
        [day("2026-11-03T18:00:00Z", 5)],
        (i) => i.at,
        (i) => i.n,
        numbersRanges("30d", NOW),
        NOW,
        money,
      ),
    ).toBeUndefined();
  });
});
