// How a task's due date reads in a list: "Today, 3:00 PM", "Tomorrow",
// "Wed, Oct 14", or "Overdue · Mar 6" — never seconds or numeric dates.

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** A date-only value ("2026-10-12") is a calendar day, not midnight UTC. */
const parseDue = (value: string): { date: Date; hasTime: boolean } => {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (dateOnly) {
    const [y, m, d] = value.split("-").map(Number);
    return { date: new Date(y, m - 1, d), hasTime: false };
  }
  const date = new Date(value);
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  return { date, hasTime };
};

const time = (d: Date) =>
  d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });

export const formatDue = (
  value: string | null | undefined,
  now: Date = new Date(),
): { label: string; isOverdue: boolean } => {
  if (!value) return { label: "No due date", isOverdue: false };
  const { date, hasTime } = parseDue(value);
  if (Number.isNaN(date.getTime())) return { label: "", isOverdue: false };
  const days = Math.round(
    (startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS,
  );
  const sameYear = date.getFullYear() === now.getFullYear();
  const day = date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const withTime = (text: string) =>
    hasTime ? `${text}, ${time(date)}` : text;

  if (days < 0) return { label: `Overdue · ${day}`, isOverdue: true };
  if (days === 0) return { label: withTime("Today"), isOverdue: false };
  if (days === 1) return { label: withTime("Tomorrow"), isOverdue: false };
  if (days < 7) {
    const weekday = date.toLocaleDateString("en-CA", { weekday: "long" });
    return { label: withTime(weekday), isOverdue: false };
  }
  return { label: withTime(day), isOverdue: false };
};
