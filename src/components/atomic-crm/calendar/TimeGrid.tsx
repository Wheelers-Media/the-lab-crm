import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

import { contactName } from "../operations/format";
import { bayLoad } from "../operations/metrics";
import { formatShopDay, formatShopTime } from "../operations/shopTime";
import type { Appointment, Contact, Task } from "../types";
import { AppointmentDetail } from "./AppointmentDetail";
import {
  gridHours,
  minutesIntoDay,
  placeEvents,
  type Timed,
} from "./gridLayout";

export interface GridDay {
  /** What the filters let through. */
  appts: Appointment[];
  /** Every visible booking, so the bay's load stays true while filtering. */
  all: Appointment[];
  tasks: Task[];
}

const HOUR_PX = 56;
/** An appointment shorter than this still gets a block big enough to read and tap. */
const MIN_MINUTES = 30;

type Block = Timed & { appointment: Appointment };

const toBlock = (appointment: Appointment): Block => {
  const startMin = minutesIntoDay(appointment.start_at);
  const length = Math.max(
    MIN_MINUTES,
    Math.round(
      (new Date(appointment.end_at).getTime() -
        new Date(appointment.start_at).getTime()) /
        60_000,
    ),
  );
  return { appointment, startMin, endMin: Math.min(1440, startMin + length) };
};

const hourLabel = (hour: number) =>
  hour === 0 || hour === 24
    ? "12 a.m."
    : hour === 12
      ? "12 p.m."
      : hour < 12
        ? `${hour} a.m.`
        : `${hour - 12} p.m.`;

/** One appointment as a block on the grid; opens the booking. */
const EventBlock = ({
  block,
  col,
  cols,
  first,
  contact,
}: {
  block: Block;
  col: number;
  cols: number;
  first: number;
  contact?: Contact;
}) => {
  const [open, setOpen] = useState(false);
  const a = block.appointment;
  const height = ((block.endMin - block.startMin) / 60) * HOUR_PX;
  const done = a.status !== "booked";
  const bay = a.resource === "detailing-bay";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${a.title}, ${bay ? "Detailing bay" : "Eric"}, ${formatShopTime(a.start_at)} to ${formatShopTime(a.end_at)}`}
        title={a.title}
        className={cn(
          "absolute z-10 min-w-0 overflow-hidden rounded-md border px-1.5 py-1 text-left text-xs leading-tight outline-none transition-[filter] hover:brightness-125 focus-visible:ring-2 focus-visible:ring-primary",
          bay
            ? "border-[color-mix(in_oklab,var(--lab-pos)_60%,transparent)] bg-[color-mix(in_oklab,var(--lab-pos)_28%,var(--card))]"
            : "border-[color-mix(in_oklab,var(--lab-blue)_60%,transparent)] bg-[color-mix(in_oklab,var(--lab-blue)_30%,var(--card))]",
          done && "opacity-60",
        )}
        style={{
          top: ((block.startMin - first * 60) / 60) * HOUR_PX,
          height: height - 2,
          left: `calc(${(col / cols) * 100}% + 2px)`,
          width: `calc(${100 / cols}% - 4px)`,
        }}
      >
        <span
          className={cn(
            "block truncate font-semibold",
            a.status === "no_show" && "line-through",
          )}
        >
          {a.title}
        </span>
        <span className="block truncate text-muted-foreground lab-num">
          {formatShopTime(a.start_at)} to {formatShopTime(a.end_at)}
        </span>
        {height >= 64 && contact ? (
          <span className="block truncate">{contactName(contact)}</span>
        ) : null}
        {height >= 84 && a.vehicle ? (
          <span className="block truncate text-muted-foreground">
            {a.vehicle}
          </span>
        ) : null}
        {height >= 64 && a.status === "booked" && !a.deposit_paid ? (
          <span className="lab-chip lab-chip-danger mt-0.5">No deposit</span>
        ) : null}
      </button>
      {open ? (
        <AppointmentDetail
          appointment={a}
          contact={contact}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
};

/**
 * The Day and Week views as Google Calendar draws them: hour lines down the
 * side, each booking a block sized and placed by its time, overlapping ones
 * side by side, a red line for now, and a click on an empty spot to add one.
 */
export const TimeGrid = ({
  days,
  byDay,
  todayKey,
  contactOf,
  onCreate,
  onOpenDay,
}: {
  days: string[];
  byDay: Map<string, GridDay>;
  todayKey: string;
  contactOf: (a: Appointment) => Contact | undefined;
  /** An empty spot was clicked: the day and the minutes into it. */
  onCreate: (day: string, minutes: number) => void;
  onOpenDay?: (day: string) => void;
}) => {
  const perDay = useMemo(
    () =>
      days.map((key) => ({
        key,
        placed: placeEvents((byDay.get(key)?.appts ?? []).map(toBlock)),
      })),
    [days, byDay],
  );
  const { start, end } = gridHours(
    perDay.flatMap((d) => d.placed.map((p) => p.event)),
  );
  const hours = Array.from({ length: end - start }, (_, i) => start + i);
  const columns = `3.25rem repeat(${days.length}, minmax(0, 1fr))`;

  // The red "now" line, nudged along once a minute
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMin - start * 60) / 60) * HOUR_PX;

  // Open at the working morning; on a long day with today on screen, an hour
  // before now, but never past the earliest booking in view
  const scroller = useRef<HTMLDivElement>(null);
  const showsToday = days.includes(todayKey);
  const earliest = Math.min(
    ...perDay.flatMap((d) =>
      d.placed.map((p) => Math.floor(p.event.startMin / 60)),
    ),
    end,
  );
  useEffect(() => {
    const target = showsToday
      ? Math.min(Math.max(start, now.getHours() - 1), Math.max(start, earliest))
      : start;
    if (scroller.current)
      scroller.current.scrollTop = (target - start) * HOUR_PX;
    // only when the shown days change, not every minute
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join(",")]);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div
        ref={scroller}
        className="max-h-[calc(100svh-15rem)] min-h-96 overflow-auto"
      >
        <div
          className="sticky top-0 z-20 grid border-b bg-card"
          style={{ gridTemplateColumns: columns }}
        >
          <div />
          {days.map((key) => {
            const day = byDay.get(key);
            const bay = (day?.all ?? []).filter(
              (a) => a.resource === "detailing-bay" && a.status !== "no_show",
            ).length;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onOpenDay?.(key)}
                disabled={!onOpenDay}
                className="flex flex-col items-center gap-0.5 border-l px-1 py-2 enabled:hover:bg-muted"
              >
                <span
                  className={cn(
                    "lab-eyebrow",
                    isToday && "text-[var(--lab-blue-text)]",
                  )}
                >
                  {formatShopDay(key, { weekday: "short" })}
                </span>
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-full text-lg lab-num",
                    isToday &&
                      "bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {formatShopDay(key, { day: "numeric" })}
                </span>
                {bay ? (
                  <span
                    className={cn(
                      "lab-chip",
                      bayLoad(bay).over ? "lab-chip-danger" : "lab-chip-bay",
                    )}
                  >
                    {bay}/{bayLoad(bay).capacity} bay
                  </span>
                ) : (
                  <span className="h-5" />
                )}
              </button>
            );
          })}
        </div>

        <div className="grid" style={{ gridTemplateColumns: columns }}>
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.slice(1).map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground lab-num"
                style={{ top: (h - start) * HOUR_PX }}
              >
                {hourLabel(h)}
              </span>
            ))}
          </div>
          {perDay.map(({ key, placed }) => (
            <div
              key={key}
              className="relative cursor-cell border-l"
              style={{
                height: hours.length * HOUR_PX,
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--border) ${HOUR_PX - 1}px, var(--border) ${HOUR_PX}px)`,
              }}
              onClick={(event) => {
                if (event.target !== event.currentTarget) return;
                const y =
                  event.clientY -
                  event.currentTarget.getBoundingClientRect().top;
                onCreate(key, start * 60 + (y / HOUR_PX) * 60);
              }}
            >
              {placed.map(({ event, col, cols }) => (
                <EventBlock
                  key={event.appointment.id}
                  block={event}
                  col={col}
                  cols={cols}
                  first={start}
                  contact={contactOf(event.appointment)}
                />
              ))}
              {key === todayKey &&
              nowTop >= 0 &&
              nowTop <= hours.length * HOUR_PX ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-[var(--lab-neg)]"
                  style={{ top: nowTop }}
                >
                  <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-[var(--lab-neg)]" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
