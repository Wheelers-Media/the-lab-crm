import { describe, expect, it } from "vitest";

import type { Deal } from "../types";
import {
  actionLabel,
  daysInStatus,
  floorColumns,
  floorCounts,
  needsChasing,
  NEXT_STATUSES,
} from "./workStatus";

const NOW = new Date("2026-10-12T17:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();

const job = (id: number, over: Partial<Deal> = {}): Deal =>
  ({ id, name: `Job ${id}`, ...over }) as Deal;

describe("daysInStatus", () => {
  it("counts whole days since the status changed", () => {
    expect(daysInStatus({ work_status_changed_at: daysAgo(3) }, NOW)).toBe(3);
    expect(daysInStatus({ work_status_changed_at: daysAgo(0.5) }, NOW)).toBe(0);
  });

  it("is unknown without a change date", () => {
    expect(daysInStatus({ work_status_changed_at: null }, NOW)).toBeNull();
  });
});

describe("needsChasing", () => {
  it("flags a vehicle ready for 2 days and one waiting on parts for 5", () => {
    expect(
      needsChasing(
        { work_status: "ready", work_status_changed_at: daysAgo(2) },
        NOW,
      ),
    ).toBe(true);
    expect(
      needsChasing(
        { work_status: "waiting_parts", work_status_changed_at: daysAgo(5) },
        NOW,
      ),
    ).toBe(true);
  });

  it("leaves newer ones, and vehicles being worked on, alone", () => {
    expect(
      needsChasing(
        { work_status: "ready", work_status_changed_at: daysAgo(1) },
        NOW,
      ),
    ).toBe(false);
    expect(
      needsChasing(
        { work_status: "waiting_parts", work_status_changed_at: daysAgo(4) },
        NOW,
      ),
    ).toBe(false);
    expect(
      needsChasing(
        { work_status: "in_shop", work_status_changed_at: daysAgo(30) },
        NOW,
      ),
    ).toBe(false);
  });
});

describe("floorColumns", () => {
  it("groups vehicles by status, longest-waiting first, and skips archived and picked-up ones", () => {
    const deals = [
      job(1, { work_status: "ready", work_status_changed_at: daysAgo(1) }),
      job(2, { work_status: "ready", work_status_changed_at: daysAgo(4) }),
      job(3, { work_status: "in_shop", work_status_changed_at: daysAgo(1) }),
      job(4, {
        work_status: "ready",
        work_status_changed_at: daysAgo(9),
        archived_at: daysAgo(1),
      }),
      job(5, { work_status: "picked_up", work_status_changed_at: daysAgo(1) }),
      job(6),
    ];

    const columns = floorColumns(deals);

    expect(columns.map((c) => c.status)).toEqual([
      "in_shop",
      "waiting_parts",
      "ready",
    ]);
    expect(columns[0].deals.map((d) => d.id)).toEqual([3]);
    expect(columns[1].deals).toEqual([]);
    expect(columns[2].deals.map((d) => d.id)).toEqual([2, 1]);
  });
});

describe("floorCounts", () => {
  it("counts each column and how many vehicles need chasing", () => {
    const deals = [
      job(1, { work_status: "in_shop", work_status_changed_at: daysAgo(8) }),
      job(2, {
        work_status: "waiting_parts",
        work_status_changed_at: daysAgo(6),
      }),
      job(3, { work_status: "ready", work_status_changed_at: daysAgo(3) }),
      job(4, { work_status: "ready", work_status_changed_at: daysAgo(0) }),
    ];

    expect(floorCounts(deals, NOW)).toEqual({
      inShop: 1,
      waitingParts: 1,
      ready: 2,
      chase: 2,
    });
  });
});

describe("moving a vehicle along", () => {
  it("starts with arriving and ends with pickup", () => {
    expect(NEXT_STATUSES.none).toEqual(["in_shop"]);
    expect(NEXT_STATUSES.ready).toEqual(["picked_up"]);
    expect(NEXT_STATUSES.picked_up).toEqual([]);
  });

  it("calls the move back from waiting on parts 'Parts in', not 'Arrived'", () => {
    expect(actionLabel(null, "in_shop")).toBe("Arrived");
    expect(actionLabel("waiting_parts", "in_shop")).toBe("Parts in");
    expect(actionLabel("in_shop", "ready")).toBe("Ready for pickup");
  });
});
