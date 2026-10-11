import { describe, expect, it } from "vitest";

import type { Deal } from "../types";
import {
  furthestStage,
  leadFunnel,
  responseSpeed,
  type StageChange,
} from "./funnelModel";
import { numbersRanges } from "./periods";

const NOW = new Date("2026-10-09T16:00:00Z");
const { current } = numbersRanges("month", NOW);

const deal = (id: number, over: Partial<Deal>): Deal =>
  ({
    id,
    name: `Job ${id}`,
    stage: "intake",
    amount: 0,
    created_at: "2026-10-02T16:00:00Z",
    lead_source: "website",
    ...over,
  }) as Deal;

const change = (
  deal_id: number,
  from_stage: string | null,
  to_stage: string,
  changed_at: string,
): StageChange => ({
  deal_id,
  from_stage,
  to_stage,
  changed_at,
});

describe("furthestStage", () => {
  it("counts a job that was Not now as far as it got before", () => {
    const lost = deal(1, { stage: "lost" });

    const reached = furthestStage(lost, [
      change(1, "quoted", "lost", "2026-10-05T00:00:00Z"),
      change(1, "qualified", "quoted", "2026-10-04T00:00:00Z"),
    ]);

    expect(reached).toBe(2); // quoted
  });

  it("places a job with no log by where it is now", () => {
    expect(furthestStage(deal(2, { stage: "booked" }), [])).toBe(3);
  });
});

describe("leadFunnel", () => {
  const deals = [
    deal(1, { stage: "won", amount: 900 }),
    deal(2, { stage: "booked", amount: 400 }),
    deal(3, { stage: "lost" }),
    deal(4, { stage: "intake", lead_source: "phone" }),
    deal(5, { stage: "won", amount: 250, lead_source: "cal.com" }),
    deal(6, { stage: "won", created_at: "2026-09-02T16:00:00Z" }), // last month's lead
  ];
  const changes = [
    change(3, "qualified", "quoted", "2026-10-04T00:00:00Z"),
    change(3, "quoted", "lost", "2026-10-06T00:00:00Z"),
  ];

  it("counts leads by source and how many got to a quote, a booking and a conversion", () => {
    const { rows, total } = leadFunnel(deals, changes, current);

    const website = rows.find((r) => r.source === "Website")!;
    expect(website).toMatchObject({
      leads: 3,
      quoted: 3,
      booked: 2,
      converted: 1,
      lost: 1,
      conversion: 33,
      value: 900,
    });
    expect(rows.find((r) => r.source === "Phone")).toMatchObject({
      leads: 1,
      quoted: 0,
      conversion: 0,
    });
    expect(total).toMatchObject({
      leads: 5,
      converted: 2,
      value: 1150,
      conversion: 40,
    });
  });

  it("only counts leads created in the period", () => {
    expect(leadFunnel(deals, changes, current).total.leads).toBe(5);
  });

  it("puts the biggest source first and names a missing source", () => {
    const { rows } = leadFunnel([deal(7, { lead_source: null })], [], current);

    expect(rows[0].source).toBe("Not recorded");
  });
});

describe("responseSpeed", () => {
  it("takes the median hours to a quote and days to convert, ignoring the row logged at creation", () => {
    const deals = [
      deal(1, { created_at: "2026-10-02T00:00:00Z" }),
      deal(2, { created_at: "2026-10-02T00:00:00Z" }),
      deal(3, { created_at: "2026-10-02T00:00:00Z" }),
    ];
    const changes = [
      change(1, null, "intake", "2026-10-02T00:00:00Z"),
      change(1, "intake", "quoted", "2026-10-02T04:00:00Z"), // 4 hours
      change(2, "intake", "quoted", "2026-10-02T10:00:00Z"), // 10 hours
      change(3, "intake", "quoted", "2026-10-03T00:00:00Z"), // 24 hours
      change(1, "quoted", "won", "2026-10-05T00:00:00Z"), // 3 days
      change(2, "quoted", "won", "2026-10-09T00:00:00Z"), // 7 days
    ];

    const speed = responseSpeed(deals, changes, current);

    expect(speed).toMatchObject({
      quoteHours: 10,
      quotedCount: 3,
      convertDays: 5,
      convertedCount: 2,
    });
  });

  it("has no speed when nothing was quoted", () => {
    expect(responseSpeed([deal(1, {})], [], current)).toMatchObject({
      quoteHours: null,
      convertDays: null,
    });
  });
});
