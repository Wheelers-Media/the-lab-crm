import { describe, expect, it } from "vitest";

import {
  type AppointmentRow,
  dayStats,
  type DealRow,
  dueReminders,
  endOfDayMessage,
  morningMessage,
  type OrderRow,
  shopClock,
  showCheckMessage,
  type TaskRow,
  taskCounts,
  unmarkedToday,
} from "./reminders";

// Fort St. John is UTC-7 all year: 15:30 UTC is 8:30 a.m. at the shop
const shop = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00-07:00`);
const MON = "2026-11-23";

let nextId = 1;
const task = (due: Date | null, extra: Partial<TaskRow> = {}): TaskRow => ({
  id: nextId++,
  text: "Call back",
  due_date: due?.toISOString() ?? null,
  done_date: null,
  sales_id: 3,
  ...extra,
});
const booking = (
  start: Date,
  extra: Partial<AppointmentRow> = {},
): AppointmentRow => ({
  id: nextId++,
  title: "Jamie Croft",
  resource: "detailing-bay",
  start_at: start.toISOString(),
  end_at: new Date(start.getTime() + 3_600_000).toISOString(),
  status: "booked",
  deposit_paid: true,
  ...extra,
});
const deal = (extra: Partial<DealRow> = {}): DealRow => ({
  id: nextId++,
  stage: "intake",
  created_at: shop("2026-11-01", "10:00").toISOString(),
  stage_changed_at: null,
  work_status: null,
  work_status_changed_at: null,
  archived_at: null,
  ...extra,
});
const order = (when: Date, extra: Partial<OrderRow> = {}): OrderRow => ({
  total: "500.00",
  refunded_amount: "0",
  is_deposit: false,
  ordered_at: when.toISOString(),
  cancelled_at: null,
  ...extra,
});

describe("when reminders go out", () => {
  it("reads the shop's clock, not UTC", () => {
    expect(shopClock(new Date("2026-11-24T02:00:00Z"))).toEqual({
      day: MON,
      weekday: 1,
      minutes: 19 * 60,
    });
  });

  it("sends the morning plan from 8:30, the show check from 4:30 and the day's numbers from 5:15", () => {
    expect(dueReminders(shop(MON, "08:29"))).toEqual([]);
    expect(dueReminders(shop(MON, "08:30"))).toEqual(["morning"]);
    expect(dueReminders(shop(MON, "16:45"))).toEqual(["shows"]);
    expect(dueReminders(shop(MON, "17:15"))).toEqual(["shows", "end_of_day"]);
  });

  it("gives up three hours late, and never on weekends", () => {
    expect(dueReminders(shop(MON, "11:30"))).toEqual([]);
    expect(dueReminders(shop("2026-11-28", "08:45"))).toEqual([]);
  });
});

describe("morning plan", () => {
  it("counts today's tasks and keeps old backlog separate", () => {
    const tasks = [
      task(shop(MON, "13:00")),
      task(shop("2026-11-20", "09:00")),
      task(shop("2026-10-10", "09:00")),
      task(shop(MON, "09:00"), { done_date: shop(MON, "07:00").toISOString() }),
    ];
    expect(taskCounts(tasks, MON)).toEqual({ today: 1, overdue: 1, older: 1 });
  });

  it("names the person and the day's bookings", () => {
    const m = morningMessage({
      firstName: "Eric",
      tasks: { today: 2, overdue: 1, older: 40 },
      appointments: [
        booking(shop(MON, "08:00")),
        booking(shop(MON, "13:00"), { resource: "eric", deposit_paid: false }),
        booking(shop(MON, "15:00"), { status: "cancelled" }),
        booking(shop("2026-11-24", "08:00")),
      ],
      day: MON,
    });
    expect(m.title).toBe("Good morning, Eric");
    expect(m.body).toBe(
      "2 tasks due today, 1 overdue, 40 older in the backlog. 1 drop-off and 1 other booking today, 1 without a deposit.",
    );
    expect(m.kind).toBe("morning");
  });

  it("still says so when the day is clear", () => {
    expect(
      morningMessage({
        firstName: null,
        tasks: { today: 0, overdue: 0, older: 0 },
        appointments: [],
        day: MON,
      }).body,
    ).toBe("No tasks due. Nothing booked today.");
  });
});

describe("who showed up", () => {
  it("lists today's bookings that have ended and nobody marked", () => {
    const now = shop(MON, "16:30");
    const list = unmarkedToday(
      [
        booking(shop(MON, "08:00"), { title: "Jamie Croft" }),
        booking(shop(MON, "10:00"), { title: "Sam Lee", status: "completed" }),
        booking(shop(MON, "16:00"), { title: "Still here" }),
        booking(shop("2026-11-20", "08:00")),
      ],
      now,
    );
    expect(list.map((a) => a.title)).toEqual(["Jamie Croft"]);
    expect(showCheckMessage(list, MON)).toMatchObject({
      title: "Who showed up today?",
      body: "Mark showed or no-show: Jamie Croft at 8:00 a.m.",
      url: "/#/?check=shows",
    });
  });

  it("sends nothing when every booking is marked", () => {
    expect(showCheckMessage([], MON)).toBeNull();
  });
});

describe("end of day", () => {
  it("adds up the shop's day", () => {
    const now = shop(MON, "17:15");
    const s = dayStats({
      day: MON,
      now,
      deals: [
        deal({
          work_status: "in_shop",
          work_status_changed_at: shop(MON, "08:10").toISOString(),
        }),
        deal({ work_status: "waiting_parts" }),
        deal({ work_status: "ready" }),
        deal({
          work_status: "picked_up",
          work_status_changed_at: shop(MON, "15:00").toISOString(),
        }),
        deal({ created_at: shop(MON, "11:00").toISOString() }),
        deal({
          stage: "quoted",
          stage_changed_at: shop("2026-11-18", "10:00").toISOString(),
        }),
        deal({
          work_status: "in_shop",
          archived_at: shop(MON, "09:00").toISOString(),
        }),
      ],
      appointments: [
        booking(shop(MON, "08:00"), { status: "completed" }),
        booking(shop(MON, "10:00"), { status: "no_show" }),
        booking(shop(MON, "13:00")),
        booking(shop(MON, "14:00"), { status: "cancelled" }),
      ],
      orders: [
        order(shop(MON, "10:00"), { total: "1200.00", refunded_amount: "200" }),
        order(shop(MON, "11:00"), { is_deposit: true, total: "50" }),
        order(shop(MON, "12:00"), {
          cancelled_at: shop(MON, "12:30").toISOString(),
        }),
        order(shop("2026-11-22", "12:00")),
      ],
      tasks: [
        task(shop(MON, "09:00"), {
          done_date: shop(MON, "10:00").toISOString(),
        }),
        task(shop(MON, "14:00")),
      ],
    });
    expect(s).toMatchObject({
      sales: 1000,
      orders: 1,
      deposits: 1,
      newLeads: 1,
      quotesWaiting: 1,
      floor: { inShop: 1, waitingParts: 1, ready: 1 },
      movedToday: { arrived: 1, pickedUp: 1 },
      bookings: { total: 3, showed: 1, noShow: 1, cancelled: 1, unmarked: 1 },
      tasks: { done: 1, open: 1 },
    });

    const m = endOfDayMessage(s);
    expect(m.title).toBe("End of day: $1,000 in sales, 1 deposit");
    expect(m.body).toBe(
      "Floor: 1 in the shop, 1 waiting on parts, 1 ready for pickup. Today: 1 arrived, 1 picked up. 1 of 3 bookings showed, 1 no-show, 1 not marked. 1 new lead, 1 quote waiting 3+ days. Tasks: 1 done, 1 open.",
    );
  });

  it("says plainly when nobody has marked the day's bookings", () => {
    const s = dayStats({
      day: MON,
      now: shop(MON, "17:15"),
      deals: [],
      appointments: [booking(shop(MON, "08:00")), booking(shop(MON, "09:00"))],
      orders: [],
      tasks: [],
    });
    expect(endOfDayMessage(s).body).toBe(
      "Floor: empty. 2 bookings, none marked yet. Tasks: 0 done, 0 open.",
    );
    expect(endOfDayMessage(s).title).toBe("End of day: $0 in sales");
  });
});
