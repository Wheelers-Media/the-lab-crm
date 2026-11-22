// Daily reminders for the team's phones: the morning plan, the "who showed
// up?" check and the end-of-day numbers. Pure: rows in, messages out, so the
// rules can be read and tested without a database. The reminders function
// (supabase/functions/reminders) loads the rows, sends, and logs each send.
import type { PushKind, PushMessage } from "./pushMessages.ts";

// Fort St. John keeps Mountain Standard Time all year (America/Dawson_Creek)
const SHOP_UTC_OFFSET_HOURS = -7;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Tasks overdue by more than this count as old backlog, not today's work. */
export const FRESH_OVERDUE_DAYS = 14;
/** A quote waiting this long is worth a call (same as the jobs board). */
export const QUOTE_WAIT_DAYS = 3;

export type ReminderKind = "morning" | "shows" | "end_of_day";

/** When each reminder goes out, shop time, Monday to Friday. */
export const REMINDER_TIMES: Record<
  ReminderKind,
  { hour: number; minute: number; pushKind: PushKind }
> = {
  morning: { hour: 8, minute: 30, pushKind: "morning" },
  shows: { hour: 16, minute: 30, pushKind: "end_of_day" },
  end_of_day: { hour: 17, minute: 15, pushKind: "end_of_day" },
};
/** A run that missed the time still sends within this window, never later. */
const LATE_MINUTES = 180;

export interface ShopClock {
  /** "2026-11-23" */
  day: string;
  /** 1 Monday ... 7 Sunday */
  weekday: number;
  /** Minutes since shop midnight. */
  minutes: number;
}

export const shopClock = (now: Date): ShopClock => {
  const local = new Date(now.getTime() + SHOP_UTC_OFFSET_HOURS * HOUR_MS);
  return {
    day: local.toISOString().slice(0, 10),
    weekday: local.getUTCDay() || 7,
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
};

/** The UTC instants a shop day starts and ends. */
export const shopDayBounds = (day: string): { start: Date; end: Date } => {
  const start = new Date(
    Date.parse(`${day}T00:00:00Z`) - SHOP_UTC_OFFSET_HOURS * HOUR_MS,
  );
  return { start, end: new Date(start.getTime() + DAY_MS) };
};

/** The reminders whose time has come today (weekdays only). */
export const dueReminders = (now: Date): ReminderKind[] => {
  const clock = shopClock(now);
  if (clock.weekday > 5) return [];
  return (Object.keys(REMINDER_TIMES) as ReminderKind[]).filter((kind) => {
    const t = REMINDER_TIMES[kind].hour * 60 + REMINDER_TIMES[kind].minute;
    return clock.minutes >= t && clock.minutes < t + LATE_MINUTES;
  });
};

// ---- Rows (only the columns the reminders read) ----------------------------

export interface TaskRow {
  id: number;
  text: string | null;
  due_date: string | null;
  done_date: string | null;
  sales_id: number | null;
}
export interface AppointmentRow {
  id: number;
  title: string | null;
  resource: string | null;
  start_at: string;
  end_at: string | null;
  status: string;
  deposit_paid: boolean | null;
}
export interface DealRow {
  id: number;
  stage: string;
  created_at: string;
  stage_changed_at: string | null;
  work_status: string | null;
  work_status_changed_at: string | null;
  archived_at: string | null;
}
export interface OrderRow {
  total: number | string | null;
  refunded_amount: number | string | null;
  is_deposit: boolean | null;
  ordered_at: string;
  cancelled_at: string | null;
}

const at = (iso: string | null | undefined) =>
  iso ? new Date(iso).getTime() : NaN;
const within = (
  iso: string | null | undefined,
  b: { start: Date; end: Date },
) => {
  const t = at(iso);
  return t >= b.start.getTime() && t < b.end.getTime();
};
const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;
const money = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;
const shopTime = (iso: string) => {
  const local = new Date(at(iso) + SHOP_UTC_OFFSET_HOURS * HOUR_MS);
  const h = local.getUTCHours();
  const m = local.getUTCMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}`;
};
const isLive = (a: AppointmentRow) =>
  a.status === "booked" || a.status === "rescheduled";

// ---- Morning ----------------------------------------------------------------

export interface TaskCounts {
  today: number;
  overdue: number;
  older: number;
}

export const taskCounts = (tasks: TaskRow[], day: string): TaskCounts => {
  const { start, end } = shopDayBounds(day);
  const fresh = start.getTime() - FRESH_OVERDUE_DAYS * DAY_MS;
  return tasks
    .filter((t) => !t.done_date && t.due_date)
    .reduce(
      (c, t) => {
        const due = at(t.due_date);
        if (due >= start.getTime() && due < end.getTime()) c.today += 1;
        else if (due < start.getTime() && due >= fresh) c.overdue += 1;
        else if (due < fresh) c.older += 1;
        return c;
      },
      { today: 0, overdue: 0, older: 0 },
    );
};

/** One person's morning: their tasks, then the shop's day. */
export const morningMessage = ({
  firstName,
  tasks,
  appointments,
  day,
}: {
  firstName: string | null;
  tasks: TaskCounts;
  appointments: AppointmentRow[];
  day: string;
}): PushMessage => {
  const bounds = shopDayBounds(day);
  const todays = appointments.filter(
    (a) => isLive(a) && within(a.start_at, bounds),
  );
  const dropOffs = todays.filter((a) => a.resource === "detailing-bay").length;
  const others = todays.length - dropOffs;
  const unpaid = todays.filter((a) => !a.deposit_paid).length;

  const taskLine = [
    tasks.today ? `${plural(tasks.today, "task")} due today` : "",
    tasks.overdue ? `${tasks.overdue} overdue` : "",
    tasks.older ? `${tasks.older} older in the backlog` : "",
  ].filter(Boolean);
  const bookingLine = todays.length
    ? [
        dropOffs ? plural(dropOffs, "drop-off") : "",
        others ? plural(others, "other booking") : "",
      ]
        .filter(Boolean)
        .join(" and ") +
      " today" +
      (unpaid ? `, ${unpaid} without a deposit` : "")
    : "Nothing booked today";

  return {
    kind: "morning",
    title: `Good morning${firstName?.trim() ? `, ${firstName.trim()}` : ""}`,
    body: `${taskLine.length ? `${taskLine.join(", ")}. ` : "No tasks due. "}${bookingLine}.`,
    url: "/#/",
    tag: `morning-${day}`,
  };
};

// ---- Who showed up ------------------------------------------------------------

/** Today's bookings whose time has passed and nobody has marked. */
export const unmarkedToday = (
  appointments: AppointmentRow[],
  now: Date,
): AppointmentRow[] => {
  const bounds = shopDayBounds(shopClock(now).day);
  return appointments
    .filter(
      (a) =>
        isLive(a) &&
        within(a.start_at, bounds) &&
        at(a.end_at ?? a.start_at) <= now.getTime(),
    )
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
};

export const showCheckMessage = (
  unmarked: AppointmentRow[],
  day: string,
): PushMessage | null => {
  if (!unmarked.length) return null;
  const names = unmarked
    .slice(0, 3)
    .map((a) => `${(a.title ?? "Booking").trim()} at ${shopTime(a.start_at)}`)
    .join(", ");
  const more = unmarked.length > 3 ? ` and ${unmarked.length - 3} more` : "";
  return {
    kind: "end_of_day",
    title: "Who showed up today?",
    body: `Mark showed or no-show: ${names}${more}`,
    url: "/#/?check=shows",
    tag: `shows-${day}`,
  };
};

// ---- End of day ---------------------------------------------------------------

export interface DayStats {
  day: string;
  /** Paid sales today, deposits and refunds excluded. */
  sales: number;
  orders: number;
  deposits: number;
  newLeads: number;
  quotesWaiting: number;
  floor: { inShop: number; waitingParts: number; ready: number };
  movedToday: { arrived: number; ready: number; pickedUp: number };
  bookings: {
    total: number;
    showed: number;
    noShow: number;
    cancelled: number;
    unmarked: number;
  };
  tasks: { done: number; open: number };
}

export const dayStats = ({
  day,
  now,
  deals,
  appointments,
  orders,
  tasks,
}: {
  day: string;
  now: Date;
  deals: DealRow[];
  appointments: AppointmentRow[];
  orders: OrderRow[];
  tasks: TaskRow[];
}): DayStats => {
  const b = shopDayBounds(day);
  const open = deals.filter((d) => !d.archived_at);
  const floorCount = (s: string) =>
    open.filter((d) => d.work_status === s).length;
  const movedTo = (s: string) =>
    deals.filter(
      (d) => d.work_status === s && within(d.work_status_changed_at, b),
    ).length;
  const paid = orders.filter((o) => !o.cancelled_at && within(o.ordered_at, b));
  const sales = paid.filter((o) => !o.is_deposit);
  const todays = appointments.filter((a) => within(a.start_at, b));
  const quoteCutoff = now.getTime() - QUOTE_WAIT_DAYS * DAY_MS;
  const counts = taskCounts(tasks, day);

  return {
    day,
    sales: sales.reduce(
      (sum, o) => sum + num(o.total) - num(o.refunded_amount),
      0,
    ),
    orders: sales.length,
    deposits: paid.filter((o) => o.is_deposit).length,
    newLeads: deals.filter((d) => within(d.created_at, b)).length,
    quotesWaiting: open.filter(
      (d) =>
        d.stage === "quoted" &&
        at(d.stage_changed_at ?? d.created_at) <= quoteCutoff,
    ).length,
    floor: {
      inShop: floorCount("in_shop"),
      waitingParts: floorCount("waiting_parts"),
      ready: floorCount("ready"),
    },
    movedToday: {
      arrived: movedTo("in_shop"),
      ready: movedTo("ready"),
      pickedUp: movedTo("picked_up"),
    },
    bookings: {
      total: todays.filter((a) => a.status !== "cancelled").length,
      showed: todays.filter((a) => a.status === "completed").length,
      noShow: todays.filter((a) => a.status === "no_show").length,
      cancelled: todays.filter((a) => a.status === "cancelled").length,
      unmarked: todays.filter(isLive).length,
    },
    tasks: {
      done: tasks.filter((t) => within(t.done_date, b)).length,
      open: counts.today + counts.overdue,
    },
  };
};

export const endOfDayMessage = (s: DayStats): PushMessage => {
  const floor = [
    s.floor.inShop ? `${s.floor.inShop} in the shop` : "",
    s.floor.waitingParts ? `${s.floor.waitingParts} waiting on parts` : "",
    s.floor.ready ? `${s.floor.ready} ready for pickup` : "",
  ].filter(Boolean);
  const moved = [
    s.movedToday.arrived ? `${s.movedToday.arrived} arrived` : "",
    s.movedToday.pickedUp ? `${s.movedToday.pickedUp} picked up` : "",
  ].filter(Boolean);
  const b = s.bookings;
  const bookings = !b.total
    ? ""
    : b.unmarked === b.total
      ? `${plural(b.total, "booking")}, none marked yet`
      : `${b.showed} of ${plural(b.total, "booking")} showed` +
        (b.noShow ? `, ${b.noShow} no-show` : "") +
        (b.unmarked ? `, ${b.unmarked} not marked` : "");
  const pipeline = [
    s.newLeads ? plural(s.newLeads, "new lead") : "",
    s.quotesWaiting
      ? `${plural(s.quotesWaiting, "quote")} waiting ${QUOTE_WAIT_DAYS}+ days`
      : "",
  ].filter(Boolean);
  const tasks = `${s.tasks.done} done, ${s.tasks.open} open`;

  const parts = [
    floor.length ? `Floor: ${floor.join(", ")}` : "Floor: empty",
    moved.length ? `Today: ${moved.join(", ")}` : "",
    bookings,
    pipeline.join(", "),
    `Tasks: ${tasks}`,
  ].filter(Boolean);

  const headline =
    `${money(s.sales)} in sales` +
    (s.deposits ? `, ${plural(s.deposits, "deposit")}` : "");
  return {
    kind: "end_of_day",
    title: `End of day: ${headline}`,
    body: `${parts.join(". ")}.`,
    url: "/#/",
    tag: `end-of-day-${s.day}`,
  };
};
