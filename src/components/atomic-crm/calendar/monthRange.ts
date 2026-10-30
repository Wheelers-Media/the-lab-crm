// Calendar-month maths for the Month view, on shop-day keys ("2026-10-30").
import { addDays, mondayOf } from "../operations/shopTime";

const pad = (n: number) => String(n).padStart(2, "0");

/** The first of the month the key falls in. */
export const monthStart = (key: string): string => `${key.slice(0, 7)}-01`;

/** Every day on the Month grid: whole weeks, Monday to Sunday, covering the month. */
export const monthDays = (key: string): string[] => {
  const [year, month] = key.split("-").map(Number);
  const first = monthStart(key);
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weeks = Math.ceil((offset + length) / 7);
  const start = mondayOf(first);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
};

/**
 * One month back or forward. Landing on the current month goes to today, so
 * the Today highlight and the day list make sense; any other month goes to its 1st.
 */
export const shiftMonth = (
  key: string,
  delta: number,
  todayKey: string,
): string => {
  const [year, month] = key.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  const next = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
  return next.slice(0, 7) === todayKey.slice(0, 7) ? todayKey : next;
};
