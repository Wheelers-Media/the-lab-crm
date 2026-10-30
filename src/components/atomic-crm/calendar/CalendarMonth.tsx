import { useState } from "react";
import { cn } from "@/lib/utils";

import { formatShopDay, formatShopTime } from "../operations/shopTime";
import { bayLoad } from "../operations/metrics";
import type { Appointment, Contact, Task } from "../types";
import { AppointmentDetail } from "./AppointmentDetail";

export interface MonthDay {
  appts: Appointment[];
  tasks: Task[];
}

/** Lines shown in a day before "+N more"; the day view has the rest. */
const MAX_LINES = 4;

/** One booking as a single line in a day cell; opens the booking. */
const MonthLine = ({
  appointment,
  contact,
}: {
  appointment: Appointment;
  contact?: Contact;
}) => {
  const [open, setOpen] = useState(false);
  const done = appointment.status !== "booked";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={appointment.title}
        className={cn(
          "flex w-full min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs hover:bg-muted",
          done && "text-muted-foreground",
          appointment.status === "no_show" && "line-through",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            appointment.resource === "detailing-bay"
              ? "bg-[var(--lab-pos)]"
              : "bg-[var(--lab-blue)]",
          )}
        />
        <span className="shrink-0 lab-num">
          {formatShopTime(appointment.start_at)}
        </span>
        <span className="min-w-0 truncate">{appointment.title}</span>
      </button>
      {open ? (
        <AppointmentDetail
          appointment={appointment}
          contact={contact}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
};

/**
 * The next weeks as a grid, Monday to Sunday. A day's number opens that day;
 * a booking line opens the booking.
 */
export const MonthGrid = ({
  days,
  byDay,
  todayKey,
  onOpenDay,
  contactOf,
}: {
  days: string[];
  byDay: Map<string, MonthDay>;
  todayKey: string;
  onOpenDay: (key: string) => void;
  contactOf: (a: Appointment) => Contact | undefined;
}) => (
  <div>
    <div className="mb-2 grid grid-cols-7 gap-2" aria-hidden="true">
      {days.slice(0, 7).map((key) => (
        <span key={key} className="lab-eyebrow px-2">
          {formatShopDay(key, { weekday: "short" })}
        </span>
      ))}
    </div>
    <div className="grid grid-cols-7 gap-2">
      {days.map((key) => {
        const day = byDay.get(key) ?? { appts: [], tasks: [] };
        const bay = day.appts.filter(
          (a) => a.resource === "detailing-bay" && a.status !== "no_show",
        ).length;
        const isToday = key === todayKey;
        const past = key < todayKey;
        const over = bayLoad(bay).over;
        return (
          <div
            key={key}
            className={cn(
              "flex min-h-32 min-w-0 flex-col gap-1 rounded-lg border bg-card p-2 xl:min-h-40",
              isToday && "border-primary ring-1 ring-primary",
              past && "bg-card/50",
            )}
          >
            <button
              type="button"
              onClick={() => onOpenDay(key)}
              aria-label={`Open ${formatShopDay(key, { weekday: "long", month: "long", day: "numeric" })}`}
              className="flex items-center justify-between gap-1 rounded px-1 text-left hover:bg-muted"
            >
              <span
                className={cn(
                  "text-sm lab-num",
                  isToday ? "font-semibold" : "text-muted-foreground",
                )}
              >
                {formatShopDay(key, { day: "numeric" })}
                {key.endsWith("-01") || days[0] === key
                  ? ` ${formatShopDay(key, { month: "short" })}`
                  : ""}
              </span>
              {bay ? (
                <span
                  className={cn(
                    "lab-chip",
                    over ? "lab-chip-danger" : "lab-chip-bay",
                  )}
                >
                  {bay}/{bayLoad(bay).capacity}
                </span>
              ) : null}
            </button>
            {day.appts.slice(0, MAX_LINES).map((a) => (
              <MonthLine key={a.id} appointment={a} contact={contactOf(a)} />
            ))}
            {day.appts.length > MAX_LINES ? (
              <button
                type="button"
                onClick={() => onOpenDay(key)}
                className="px-1 text-left text-xs text-muted-foreground hover:text-foreground"
              >
                +{day.appts.length - MAX_LINES} more
              </button>
            ) : null}
            {day.tasks.length ? (
              <p className="mt-auto px-1 text-xs text-muted-foreground">
                {day.tasks.length} {day.tasks.length === 1 ? "task" : "tasks"}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  </div>
);
