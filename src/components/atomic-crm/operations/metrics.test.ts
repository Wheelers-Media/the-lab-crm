import { describe, expect, it } from "vitest";

import type { Appointment, Deal, Order, ShopifyCheckout, Task } from "../types";
import {
  bayLoad,
  cartStats,
  cumulativeRevenue,
  dayLoads,
  leadStats,
  openPipeline,
  orderRevenue,
  percentChange,
} from "./metrics";
import { bookingsToCheck, needsAttention } from "./attentionModel";
import {
  addDays,
  mondayOf,
  periodRange,
  previousPeriodRange,
  shopDayKey,
  startOfShopDay,
} from "./shopTime";

// Friday Oct 9 2026, 9:00 in Fort St. John (UTC-7, no daylight saving)
const NOW = new Date("2026-10-09T16:00:00Z");

const deal = (over: Partial<Deal>): Deal =>
  ({
    id: Math.random(),
    name: "Deal",
    stage: "intake",
    amount: 0,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    contact_ids: [],
    ...over,
  }) as Deal;

describe("shop time", () => {
  it("uses the shop's calendar day, not UTC", () => {
    // 11 pm in Fort St. John is already the next day in UTC
    expect(shopDayKey("2026-10-10T06:00:00Z")).toBe("2026-10-09");
    expect(startOfShopDay("2026-10-09").toISOString()).toBe(
      "2026-10-09T07:00:00.000Z",
    );
  });

  it("starts weeks on Monday and handles month and year edges", () => {
    expect(mondayOf("2026-10-09")).toBe("2026-10-05");
    expect(mondayOf("2026-10-11")).toBe("2026-10-05");
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("builds today, week and month ranges with matching previous periods", () => {
    const week = periodRange("week", NOW);
    expect(week.start.toISOString()).toBe("2026-10-05T07:00:00.000Z");
    expect(week.end.toISOString()).toBe("2026-10-12T07:00:00.000Z");
    const month = periodRange("month", NOW);
    expect(month.start.toISOString()).toBe("2026-10-01T07:00:00.000Z");
    expect(month.end.toISOString()).toBe("2026-11-01T07:00:00.000Z");
    // Compared with the same 8 days and 9 hours of September
    const before = previousPeriodRange("month", NOW);
    expect(before.start.toISOString()).toBe("2026-09-01T07:00:00.000Z");
    expect(before.end.toISOString()).toBe("2026-09-09T16:00:00.000Z");
    expect(previousPeriodRange("week", NOW).end.toISOString()).toBe(
      "2026-10-02T16:00:00.000Z",
    );
  });
});

describe("dashboard numbers", () => {
  it("counts revenue in the period net of refunds, skipping cancelled orders", () => {
    const orders = [
      { total: 500, refunded_amount: 50, ordered_at: "2026-10-02T18:00:00Z" },
      {
        total: 300,
        refunded_amount: 0,
        ordered_at: "2026-10-03T18:00:00Z",
        cancelled_at: "2026-10-03T19:00:00Z",
      },
      { total: 999, refunded_amount: 0, ordered_at: "2026-09-30T18:00:00Z" },
    ] as Order[];
    expect(orderRevenue(orders, periodRange("month", NOW))).toBe(450);
  });

  it("runs revenue up to today and the same point last month beside it", () => {
    const orders = [
      { total: 500, refunded_amount: 50, ordered_at: "2026-10-02T18:00:00Z" },
      { total: 200, refunded_amount: 0, ordered_at: "2026-10-07T18:00:00Z" },
      {
        total: 900,
        refunded_amount: 0,
        ordered_at: "2026-10-08T18:00:00Z",
        cancelled_at: "2026-10-08T19:00:00Z",
      },
      { total: 100, refunded_amount: 0, ordered_at: "2026-09-02T18:00:00Z" },
      { total: 300, refunded_amount: 0, ordered_at: "2026-09-07T18:00:00Z" },
    ] as Order[];

    const points = cumulativeRevenue(
      orders,
      periodRange("month", NOW),
      previousPeriodRange("month", NOW),
      NOW,
    );

    // Nine shop days so far, and the last one stops at 9 am
    expect(points).toHaveLength(9);
    expect(points.map((p) => p.key)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
    // Empty days hold the running total; the cancelled order never counts
    expect(points.map((p) => p.value)).toEqual([
      0, 450, 450, 450, 450, 450, 650, 650, 650,
    ]);
    // Last month, same day of the month, same time of day
    expect(points.map((p) => p.previous)).toEqual([
      0, 100, 100, 100, 100, 100, 400, 400, 400,
    ]);
  });

  it("compares a part-day against the same part of the day last month", () => {
    const orders = [
      // 9 am last month, in the same nine hours we have today
      { total: 111, refunded_amount: 0, ordered_at: "2026-09-09T15:00:00Z" },
      // 1 pm last month, after the point we have reached
      { total: 222, refunded_amount: 0, ordered_at: "2026-09-09T20:00:00Z" },
    ] as Order[];

    const points = cumulativeRevenue(
      orders,
      periodRange("month", NOW),
      previousPeriodRange("month", NOW),
      NOW,
    );

    expect(points[points.length - 1].previous).toBe(111);
  });

  it("steps by the hour for a single day, from opening to now", () => {
    const orders = [
      { total: 200, refunded_amount: 0, ordered_at: "2026-10-09T15:00:00Z" },
      { total: 80, refunded_amount: 0, ordered_at: "2026-10-09T15:30:00Z" },
    ] as Order[];

    const points = cumulativeRevenue(
      orders,
      periodRange("today", NOW),
      previousPeriodRange("today", NOW),
      NOW,
      "hour",
    );

    // Two whole hours on the shop clock: 7 to 8, and 8 to 9, where it stops
    expect(points.map((p) => p.label)).toEqual(["7a", "8a"]);
    expect(points.map((p) => p.value)).toEqual([0, 280]);
  });

  it("has nothing to chart before the shop opens", () => {
    const early = new Date("2026-10-09T10:00:00Z"); // 3 am in Fort St. John
    expect(
      cumulativeRevenue(
        [],
        periodRange("today", early),
        previousPeriodRange("today", early),
        early,
        "hour",
      ),
    ).toEqual([]);
  });

  it("reports a percent change only when there is something to compare with", () => {
    expect(percentChange(112, 100)).toBe(12);
    expect(percentChange(50, 0)).toBeNull();
  });

  it("counts leads created in the period and how many reached Booked or Converted", () => {
    const deals = [
      deal({ lead_source: "website", stage: "booked" }),
      deal({ lead_source: "website", stage: "quoted" }),
      deal({ stage: "won" }),
      deal({ stage: "lost", created_at: "2026-08-01T00:00:00Z" }),
    ];
    expect(leadStats(deals, periodRange("month", NOW))).toEqual({
      total: 3,
      website: 2,
      booked: 2,
      conversion: 67,
    });
  });

  it("sums only open deals in the pipeline", () => {
    const deals = [
      deal({ stage: "quoted", amount: 850 }),
      deal({ stage: "won", amount: 900 }),
      deal({
        stage: "intake",
        amount: 180,
        archived_at: "2026-10-01T00:00:00Z",
      }),
    ];
    expect(openPipeline(deals)).toEqual({ amount: 850, count: 1 });
  });

  it("counts detailing bay and Eric bookings per shop day, ignoring cancellations", () => {
    const appointments = [
      {
        resource: "detailing-bay",
        status: "booked",
        start_at: "2026-10-09T15:00:00Z",
      },
      {
        resource: "detailing-bay",
        status: "cancelled",
        start_at: "2026-10-09T15:30:00Z",
      },
      { resource: "eric", status: "booked", start_at: "2026-10-09T17:00:00Z" },
    ] as Appointment[];
    expect(dayLoads(appointments, ["2026-10-09", "2026-10-10"])).toEqual([
      { key: "2026-10-09", bay: 1, eric: 1 },
      { key: "2026-10-10", bay: 0, eric: 0 },
    ]);
  });
});

describe("needs attention", () => {
  it("lists big abandoned carts, unpaid upcoming bookings, new requests, stale quotes and overdue tasks", () => {
    const items = needsAttention({
      now: NOW,
      checkouts: [
        { total: 2640, checkout_updated_at: "2026-10-09T13:00:00Z" },
        { total: 300, checkout_updated_at: "2026-10-09T13:00:00Z" },
        { total: 5000, checkout_updated_at: "2026-10-09T15:30:00Z" }, // under an hour old
      ] as ShopifyCheckout[],
      appointments: [
        {
          title: "Highlander",
          status: "booked",
          deposit_paid: false,
          resource: "detailing-bay",
          start_at: "2026-10-12T15:00:00Z",
        },
        {
          title: "Paid",
          status: "booked",
          deposit_paid: true,
          resource: "detailing-bay",
          start_at: "2026-10-12T15:30:00Z",
        },
      ] as Appointment[],
      deals: [
        deal({ stage: "intake" }),
        deal({
          stage: "quoted",
          amount: 850,
          stage_changed_at: "2026-10-05T16:00:00Z",
        }),
        deal({
          stage: "quoted",
          amount: 260,
          stage_changed_at: "2026-10-08T16:00:00Z",
        }),
      ],
      tasks: [
        { due_date: "2026-10-08T16:00:00Z" },
        { due_date: "2026-10-08T16:00:00Z", done_date: "2026-10-08T17:00:00Z" },
        { due_date: "2026-10-10T16:00:00Z" },
      ] as Task[],
    });
    expect(items.map((i) => [i.kind, i.count])).toEqual([
      ["abandoned-cart", 1],
      ["no-deposit", 1],
      ["new-requests", 1],
      ["quotes-waiting", 1],
      ["overdue-tasks", 1],
    ]);
    expect(items[0].amount).toBe(2640);
    expect(items[1].detail).toBe("Highlander");
  });

  it("counts requests, quotes and tasks older than 60 days as older, not as today's work", () => {
    // Arrange: one of each from this month, one of each from last spring
    const spring = "2026-04-01T16:00:00Z";
    const items = needsAttention({
      now: NOW,
      checkouts: [],
      appointments: [],
      deals: [
        deal({ stage: "intake" }),
        deal({ stage: "intake", created_at: spring }),
        deal({ stage: "quoted", stage_changed_at: "2026-10-01T16:00:00Z" }),
        deal({ stage: "quoted", stage_changed_at: spring }),
      ],
      tasks: [
        { due_date: "2026-10-08T16:00:00Z" },
        { due_date: spring },
      ] as Task[],
    });

    // Assert
    expect(items.map((i) => [i.kind, i.count, i.older])).toEqual([
      ["new-requests", 1, 1],
      ["quotes-waiting", 1, 1],
      ["overdue-tasks", 1, 1],
    ]);
  });

  it("asks whether last week's unsettled bookings showed up, not today's or settled ones", () => {
    // Arrange: NOW is Fri Oct 9 2026, 9:00 shop time
    const appointment = (start_at: string, status: Appointment["status"]) =>
      ({ title: start_at, status, resource: "eric", start_at }) as Appointment;
    const appointments = [
      appointment("2026-10-08T16:00:00Z", "booked"), // yesterday
      appointment("2026-10-05T16:00:00Z", "booked"), // Monday
      appointment("2026-10-07T16:00:00Z", "completed"), // paid, done
      appointment("2026-10-06T16:00:00Z", "no_show"),
      appointment("2026-10-09T15:00:00Z", "booked"), // today, still to come
      appointment("2026-09-20T16:00:00Z", "booked"), // weeks ago
    ];

    // Act
    const toCheck = bookingsToCheck(appointments, NOW);
    const items = needsAttention({
      now: NOW,
      checkouts: [],
      deals: [],
      tasks: [],
      appointments,
    });

    // Assert
    expect(toCheck.map((a) => a.start_at)).toEqual([
      "2026-10-05T16:00:00Z",
      "2026-10-08T16:00:00Z",
    ]);
    expect(items.find((i) => i.kind === "show-check")?.count).toBe(2);
  });

  it("leaves a group out when everything in it is past the window", () => {
    const items = needsAttention({
      now: NOW,
      checkouts: [],
      appointments: [],
      deals: [],
      tasks: [{ due_date: "2026-04-01T16:00:00Z" }] as Task[],
    });
    expect(items).toEqual([]);
  });

  it("flags vehicles ready for pickup 2+ days and waiting on parts 5+ days, newest not yet", () => {
    const items = needsAttention({
      now: NOW,
      checkouts: [],
      appointments: [],
      tasks: [],
      deals: [
        deal({
          stage: "won",
          work_status: "ready",
          work_status_changed_at: "2026-10-06T16:00:00Z", // 3 days
        }),
        deal({
          stage: "won",
          work_status: "ready",
          work_status_changed_at: "2026-10-08T16:00:00Z", // 1 day
        }),
        deal({
          stage: "won",
          work_status: "waiting_parts",
          work_status_changed_at: "2026-10-03T16:00:00Z", // 6 days
        }),
        deal({
          stage: "won",
          work_status: "waiting_parts",
          work_status_changed_at: "2026-10-06T16:00:00Z", // 3 days
        }),
        deal({
          stage: "won",
          work_status: "ready",
          work_status_changed_at: "2026-10-01T16:00:00Z",
          archived_at: "2026-10-08T16:00:00Z",
        }),
      ],
    });

    expect(items.map((i) => [i.kind, i.count])).toEqual([
      ["pickups-waiting", 1],
      ["parts-waiting", 1],
    ]);
  });

  it("returns nothing when everything is handled", () => {
    expect(
      needsAttention({
        now: NOW,
        deals: [],
        appointments: [],
        checkouts: [],
        tasks: [],
      }),
    ).toEqual([]);
  });
});

describe("checkout metrics", () => {
  const month = periodRange("month", NOW);

  it("measures checkout completion, leaving carts under an hour old out", () => {
    const checkout = (over: Partial<ShopifyCheckout>) =>
      ({
        total: 100,
        completed_at: null,
        checkout_updated_at: "2026-10-05T18:00:00Z",
        ...over,
      }) as ShopifyCheckout;
    const stats = cartStats(
      [
        checkout({ completed_at: "2026-10-05T18:10:00Z" }),
        checkout({ total: 250 }),
        checkout({ total: 300 }),
        checkout({ checkout_updated_at: "2026-10-09T15:30:00Z" }), // in progress
        checkout({ checkout_updated_at: "2026-09-05T18:00:00Z" }), // last month
      ],
      month,
      NOW,
    );
    expect(stats).toEqual({
      started: 3,
      completed: 1,
      abandoned: 2,
      abandonedValue: 550,
      completionRate: 33,
    });
  });
});

describe("bayLoad", () => {
  it("counts up to the two drop-offs the bay takes", () => {
    expect(bayLoad(0)).toEqual({
      booked: 0,
      capacity: 2,
      over: 0,
      label: "0 of 2 drop-offs",
      short: "0/2",
    });
    expect(bayLoad(1).label).toBe("1 of 2 drop-offs");
    expect(bayLoad(2)).toMatchObject({
      over: 0,
      label: "2 of 2 drop-offs, full",
    });
  });

  it("says how far over an overbooked day is, instead of looking merely full", () => {
    expect(bayLoad(4)).toEqual({
      booked: 4,
      capacity: 2,
      over: 2,
      label: "4 of 2 drop-offs, over by 2",
      short: "4/2",
    });
  });
});
