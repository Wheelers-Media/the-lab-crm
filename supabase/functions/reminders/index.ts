// Daily reminders, called every 15 minutes by pg_cron (migration
// 20261122120000_daily_reminders.sql). Sends what is due right now, shop time:
// - 8:30 a.m.  each person's morning plan (their tasks, the day's bookings)
// - 4:30 p.m.  who showed up: today's bookings nobody has marked
// - 5:15 p.m.  the day's numbers, also saved to shop_day_log
// Each reminder goes out once a day (reminder_log), weekdays only, and only in
// its window, so a stray or repeated call sends nothing. It needs no login: it
// takes no input and only sends the team's own reminders to the team.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { sendPush, type Subscription } from "../_shared/lab/push.ts";
import { type PushMessage, wantsKind } from "../_shared/lab/pushMessages.ts";
import {
  type AppointmentRow,
  dayStats,
  type DealRow,
  dueReminders,
  endOfDayMessage,
  morningMessage,
  type OrderRow,
  type ReminderKind,
  REMINDER_TIMES,
  shopClock,
  shopDayBounds,
  showCheckMessage,
  taskCounts,
  type TaskRow,
  unmarkedToday,
} from "../_shared/lab/reminders.ts";

type Device = Subscription & {
  sales_id: number;
  sales: { first_name: string | null };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const rows = async <T>(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> => {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
};

/** Claims today's slot for a reminder; false when it was already sent. */
const claim = async (kind: ReminderKind, day: string, salesId = 0) => {
  const { data, error } = await supabaseAdmin
    .from("reminder_log")
    .upsert(
      { kind, day, sales_id: salesId },
      { onConflict: "kind,day,sales_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
};
const release = (kind: ReminderKind, day: string, salesId = 0) =>
  supabaseAdmin
    .from("reminder_log")
    .delete()
    .match({ kind, day, sales_id: salesId });

/** Sends, and gives the slot back if nothing could be sent, so the next run retries. */
const deliver = async (
  kind: ReminderKind,
  day: string,
  devices: Device[],
  message: PushMessage,
  salesId = 0,
): Promise<boolean> => {
  if (!devices.length || !(await claim(kind, day, salesId))) return false;
  try {
    const results = await sendPush(devices, message);
    if (results.some((r) => r.ok)) return true;
  } catch (e) {
    console.error(
      "reminder send failed",
      kind,
      e instanceof Error ? e.message : e,
    );
  }
  await release(kind, day, salesId);
  return false;
};

Deno.serve(async () => {
  const now = new Date();
  const due = dueReminders(now);
  if (!due.length) return json({ due });

  try {
    const { day } = shopClock(now);
    const { start, end } = shopDayBounds(day);
    const from = start.toISOString();
    const to = end.toISOString();

    const devices = await rows<Device>(
      supabaseAdmin
        .from("push_subscriptions")
        .select(
          "id, endpoint, p256dh, auth, prefs, sales_id, sales!inner(first_name, disabled)",
        )
        .eq("sales.disabled", false),
    );
    const wanting = (kind: ReminderKind) =>
      devices.filter((d) => wantsKind(d.prefs, REMINDER_TIMES[kind].pushKind));
    if (!devices.length) return json({ due, sent: [] });

    const [appointments, tasks] = await Promise.all([
      rows<AppointmentRow>(
        supabaseAdmin
          .from("appointments")
          .select("id, title, resource, start_at, end_at, status, deposit_paid")
          .gte("start_at", from)
          .lt("start_at", to),
      ),
      rows<TaskRow>(
        supabaseAdmin
          .from("tasks")
          .select("id, text, due_date, done_date, sales_id")
          .or(`done_date.is.null,done_date.gte.${from}`),
      ),
    ]);
    const sent: string[] = [];

    if (due.includes("morning")) {
      const people = new Map<number, Device[]>();
      for (const d of wanting("morning")) {
        people.set(d.sales_id, [...(people.get(d.sales_id) ?? []), d]);
      }
      for (const [salesId, own] of people) {
        const message = morningMessage({
          firstName: own[0].sales?.first_name ?? null,
          tasks: taskCounts(
            tasks.filter((t) => t.sales_id === salesId),
            day,
          ),
          appointments,
          day,
        });
        if (await deliver("morning", day, own, message, salesId)) {
          sent.push(`morning:${salesId}`);
        }
      }
    }

    if (due.includes("shows")) {
      const message = showCheckMessage(unmarkedToday(appointments, now), day);
      if (message && (await deliver("shows", day, wanting("shows"), message))) {
        sent.push("shows");
      }
    }

    if (due.includes("end_of_day")) {
      const [deals, orders] = await Promise.all([
        rows<DealRow>(
          supabaseAdmin
            .from("deals")
            .select(
              "id, stage, created_at, stage_changed_at, work_status, work_status_changed_at, archived_at",
            )
            .or(
              `archived_at.is.null,work_status_changed_at.gte.${from},created_at.gte.${from}`,
            ),
        ),
        rows<OrderRow>(
          supabaseAdmin
            .from("orders")
            .select(
              "total, refunded_amount, is_deposit, ordered_at, cancelled_at",
            )
            .gte("ordered_at", from)
            .lt("ordered_at", to),
        ),
      ]);
      const stats = dayStats({ day, now, deals, appointments, orders, tasks });
      // Kept even when nobody gets the alert, to track the shop over time
      const { error } = await supabaseAdmin
        .from("shop_day_log")
        .upsert({ day, stats, updated_at: now.toISOString() });
      if (error) console.error("shop_day_log failed", error.message);
      if (
        await deliver(
          "end_of_day",
          day,
          wanting("end_of_day"),
          endOfDayMessage(stats),
        )
      ) {
        sent.push("end_of_day");
      }
    }

    return json({ due, sent });
  } catch (e) {
    console.error("reminders failed", e instanceof Error ? e.message : e);
    return json({ due, error: "failed" }, 500);
  }
});
