import { describe, expect, it } from "vitest";

import {
  keywordRows,
  monthLabel,
  parseRoles,
  type ReferralLine,
} from "./referralModel";

const line = (over: Partial<ReferralLine>): ReferralLine => ({
  id: "x",
  program_code: "nw",
  month: "2026-11-01",
  kind: "earned",
  order_id: 1,
  order_number: "#1",
  ordered_at: "2026-11-10T00:00:00Z",
  contact_id: 1,
  customer: "Test",
  keyword: "L5P",
  credited_by: "link",
  roles: ["tune", "exhaust"],
  rule: "Full kit",
  full_kit: true,
  amount: 100,
  ...over,
});

describe("referral model", () => {
  it("sums kits and commission per keyword, refunds included", () => {
    const rows = keywordRows([
      line({}),
      line({ full_kit: false, amount: 50 }),
      line({ keyword: null, full_kit: false, amount: 50 }),
      line({ kind: "refund", amount: -100 }),
    ]);
    expect(rows).toEqual([
      { keyword: "L5P", fullKits: 1, halfKits: 1, amount: 50 },
      { keyword: "(no keyword)", fullKits: 0, halfKits: 1, amount: 50 },
    ]);
  });

  it("reads roles the way Eric types them", () => {
    expect(parseRoles("Tune + Exhaust, tune")).toEqual(["tune", "exhaust"]);
    expect(parseRoles("  ")).toEqual([]);
  });

  it("names the month", () => {
    expect(monthLabel("2026-11-01")).toMatch(/November 2026/);
  });
});
