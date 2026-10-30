import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useGetList } from "ra-core";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { bayLoad } from "../operations/metrics";
import { contactName } from "../operations/format";
import {
  DepositChip,
  KpiTile,
  ResourceChip,
} from "../operations/OperationsWidgets";
import {
  addDays,
  formatShopDay,
  formatShopTime,
  mondayOf,
  shopDayKey,
  startOfShopDay,
} from "../operations/shopTime";
import { useAppointments } from "../operations/useOperationsData";
import type { Appointment, Contact, Task } from "../types";
import { AddAppointment } from "./AddAppointment";
import { ActionRow } from "../misc/ActionRow";
import { AppointmentDetail } from "./AppointmentDetail";
import { MonthGrid } from "./CalendarMonth";
import { GoogleCalendarSync } from "./GoogleCalendarSync";
import { useAppointmentActions } from "./useAppointmentActions";

type View = "month" | "week" | "day" | "list";

/** The 30 days view is five whole weeks, so every row is Monday to Sunday. */
const MONTH_DAYS = 35;
/** The appointment list runs this many days from the chosen date. */
const LIST_DAYS = 30;

const VISIBLE = ["booked", "completed", "no_show"];

const useCalendarParams = () => {
  const [params, setParams] = useSearchParams();
  const dateParam = params.get("date");
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : shopDayKey(new Date());
  const raw = params.get("view");
  const view: View =
    raw === "day" || raw === "month" || raw === "list" ? raw : "week";
  const go = (next: { date?: string; view?: View }) => {
    const p = new URLSearchParams(params);
    p.set("date", next.date ?? date);
    p.set("view", next.view ?? view);
    setParams(p, { replace: true });
  };
  return { date, view, go };
};

/**
 * One booking. The whole card opens the appointment: the customer to call, the
 * notes, and the Google event behind it.
 */
const AppointmentCard = ({
  appointment,
  contact,
  detailed,
}: {
  appointment: Appointment;
  contact?: Contact;
  detailed?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const { actions, swipeLeft, swipeRight } = useAppointmentActions({
    appointment,
    contact,
    onOpen: () => setOpen(true),
  });
  return (
    <>
      <ActionRow
        title={appointment.title}
        subtitle={`${formatShopDay(shopDayKey(appointment.start_at), { weekday: "short", day: "numeric", month: "short" })}, ${formatShopTime(appointment.start_at)}`}
        actions={actions}
        swipeLeft={swipeLeft}
        swipeRight={swipeRight}
      >
        <Card
          role="button"
          tabIndex={0}
          aria-label={`${appointment.title}, ${formatShopTime(appointment.start_at)}`}
          onClick={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen(true);
            }
          }}
          className={cn(
            "p-3 gap-1 cursor-pointer transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary outline-none",
            // Finished bookings sit back on a quieter background; fading the
            // whole card took the grey text under readable contrast
            appointment.status !== "booked" && "bg-muted/40",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold lab-num">
              {formatShopTime(appointment.start_at)}
              {detailed ? ` to ${formatShopTime(appointment.end_at)}` : ""}
            </span>
            <ResourceChip resource={appointment.resource} />
          </div>
          <p className="text-sm font-medium leading-snug">
            {appointment.title}
          </p>
          {contact ? (
            <p className="text-xs text-muted-foreground">
              {contactName(contact)}
            </p>
          ) : null}
          {appointment.vehicle ? (
            <p className="text-xs text-muted-foreground">
              {appointment.vehicle}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1 mt-1">
            {appointment.status === "completed" ? (
              <span className="lab-chip lab-chip-muted">Done</span>
            ) : appointment.status === "no_show" ? (
              <span className="lab-chip lab-chip-danger">No-show</span>
            ) : (
              <DepositChip appointment={appointment} />
            )}
          </div>
          {detailed && appointment.notes ? (
            <p className="text-xs text-muted-foreground whitespace-pre-line mt-1 line-clamp-3">
              {appointment.notes}
            </p>
          ) : null}
        </Card>
      </ActionRow>
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

const bayChip = (count: number) => {
  const load = bayLoad(count);
  return (
    <span
      className={cn(
        "lab-chip",
        load.over
          ? "lab-chip-danger"
          : count > 0
            ? "lab-chip-bay"
            : "lab-chip-muted",
      )}
    >
      {load.label}
    </span>
  );
};

const DayTasks = ({ tasks }: { tasks: Task[] }) =>
  tasks.length ? (
    <div className="flex flex-col gap-1 mt-1">
      {tasks.slice(0, 4).map((t) => (
        <p key={t.id} className="text-xs text-muted-foreground truncate">
          {t.text}
        </p>
      ))}
      {tasks.length > 4 ? (
        <p className="text-xs text-muted-foreground">
          +{tasks.length - 4} more tasks
        </p>
      ) : null}
    </div>
  ) : null;

/** Every booking in the stretch, day by day, with the empty days left out. */
const AgendaList = ({
  keys,
  byDay,
  todayKey,
  contactOf,
  onOpenDay,
}: {
  keys: string[];
  byDay: Map<string, { appts: Appointment[]; tasks: Task[] }>;
  todayKey: string;
  contactOf: (a: Appointment) => Contact | undefined;
  onOpenDay: (key: string) => void;
}) => {
  const days = keys.filter((key) => (byDay.get(key)?.appts.length ?? 0) > 0);
  if (!days.length)
    return (
      <p className="text-sm text-muted-foreground">
        No appointments in this stretch.
      </p>
    );
  return (
    <div className="flex flex-col gap-6">
      {days.map((key) => {
        const appts = byDay.get(key)!.appts;
        return (
          <section key={key} aria-label={key}>
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenDay(key)}
                className={cn(
                  "lab-eyebrow hover:text-foreground",
                  key === todayKey && "text-foreground",
                )}
              >
                {key === todayKey ? "Today · " : ""}
                {formatShopDay(key, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </button>
              <span className="lab-chip lab-chip-muted lab-num">
                {appts.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {appts.map((a) => (
                <AppointmentCard
                  key={a.id}
                  appointment={a}
                  contact={contactOf(a)}
                  detailed
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export const CalendarPage = () => {
  const { date, view: urlView, go } = useCalendarParams();
  const isMobile = useIsMobile();
  // A seven-column grid does not fit a phone; the list is its iOS-style stand-in
  const view: View = isMobile && urlView === "month" ? "list" : urlView;
  const todayKey = shopDayKey(new Date());
  const monday = mondayOf(date);
  const startKey = view === "day" || view === "list" ? date : monday;
  const endKey =
    view === "day"
      ? addDays(date, 1)
      : view === "list"
        ? addDays(date, LIST_DAYS)
        : addDays(monday, view === "month" ? MONTH_DAYS : 7);

  const { appointments, contactsById } = useAppointments(startKey, endKey);
  const { data: tasks = [] } = useGetList<Task>("tasks", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "due_date", order: "ASC" },
    filter: {
      "done_date@is": null,
      "due_date@gte": startOfShopDay(startKey).toISOString(),
      "due_date@lt": startOfShopDay(endKey).toISOString(),
    },
  });

  const byDay = useMemo(() => {
    const linkedTasks = new Set(
      appointments.map((a) => a.task_id).filter((id) => id != null),
    );
    const map = new Map<string, { appts: Appointment[]; tasks: Task[] }>();
    const count =
      view === "day"
        ? 1
        : view === "list"
          ? LIST_DAYS
          : view === "month"
            ? MONTH_DAYS
            : 7;
    const first = view === "day" || view === "list" ? date : monday;
    const days = Array.from({ length: count }, (_, i) => addDays(first, i));
    for (const key of days) map.set(key, { appts: [], tasks: [] });
    for (const a of appointments) {
      if (!VISIBLE.includes(a.status)) continue;
      map.get(shopDayKey(a.start_at))?.appts.push(a);
    }
    for (const t of tasks) {
      if (linkedTasks.has(t.id)) continue;
      map.get(shopDayKey(t.due_date))?.tasks.push(t);
    }
    return map;
  }, [appointments, tasks, view, date, monday]);

  // Monday to Friday always; weekend days only when something is on them
  const dayKeys = [...byDay.keys()].filter((key, i) => {
    if (view !== "week" || i < 5) return true;
    const d = byDay.get(key)!;
    return d.appts.length + d.tasks.length > 0;
  });

  const contactOf = (a: Appointment) =>
    a.contact_id != null ? contactsById.get(a.contact_id) : undefined;

  // The day's load, so a full bay and a badly overbooked one don't look alike
  const dayAppts = byDay.get(date)?.appts ?? [];
  const kept = (list: Appointment[]) =>
    list.filter((a) => a.status !== "no_show").length;
  const dayBay = kept(dayAppts.filter((a) => a.resource === "detailing-bay"));
  const dayEric = kept(dayAppts.filter((a) => a.resource === "eric"));
  const dayOver = bayLoad(dayBay).over;
  // Today: what is still to come; another day: its first booking
  const upNext = [...dayAppts]
    .filter(
      (a) =>
        a.status === "booked" &&
        (date !== todayKey || new Date(a.end_at).getTime() > Date.now()),
    )
    .sort((a, b) => a.start_at.localeCompare(b.start_at))[0];

  const step =
    view === "day"
      ? 1
      : view === "week"
        ? 7
        : view === "month"
          ? 28
          : LIST_DAYS;
  const span = (from: string, days: number) =>
    `${formatShopDay(from, { month: "short", day: "numeric" })} to ${formatShopDay(addDays(from, days - 1), { month: "short", day: "numeric" })}`;
  const rangeLabel =
    view === "day"
      ? formatShopDay(date, { weekday: "long", month: "long", day: "numeric" })
      : view === "list"
        ? span(date, LIST_DAYS)
        : span(monday, view === "month" ? MONTH_DAYS : 7);

  return (
    <div className="flex flex-col gap-4 mt-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl">Calendar</h1>
          <span className="text-muted-foreground ml-2">{rangeLabel}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            aria-label="Previous"
            onClick={() => go({ date: addDays(date, -step) })}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => go({ date: todayKey })}
          >
            Today
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label="Next"
            onClick={() => go({ date: addDays(date, step) })}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(v) => v && go({ view: v as View })}
            aria-label="View"
          >
            <ToggleGroupItem value="day" className="px-3">
              Day
            </ToggleGroupItem>
            <ToggleGroupItem value="week" className="px-3">
              Week
            </ToggleGroupItem>
            {isMobile ? null : (
              <ToggleGroupItem value="month" className="px-3">
                30 days
              </ToggleGroupItem>
            )}
            <ToggleGroupItem value="list" className="px-3">
              List
            </ToggleGroupItem>
          </ToggleGroup>
          <AddAppointment defaultDay={date} />
        </div>
      </div>
      <GoogleCalendarSync />

      {view === "month" ? (
        <MonthGrid
          days={dayKeys}
          byDay={byDay}
          todayKey={todayKey}
          onOpenDay={(key) => go({ date: key, view: "day" })}
          contactOf={contactOf}
        />
      ) : view === "list" ? (
        <AgendaList
          keys={dayKeys}
          byDay={byDay}
          todayKey={todayKey}
          contactOf={contactOf}
          onOpenDay={(key) => go({ date: key, view: "day" })}
        />
      ) : view === "day" ? (
        <div className="flex flex-col gap-3">
          <p className="sr-only" aria-live="polite">
            {dayAppts.length}{" "}
            {dayAppts.length === 1 ? "appointment" : "appointments"}, {dayBay}{" "}
            in the bay, {dayEric} with Eric
            {dayOver ? `, ${dayOver} over the bay's 2 drop-offs` : ""}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <KpiTile
              label="Appointments"
              value={String(dayAppts.length)}
              detail={date === todayKey ? "Today" : "This day"}
            />
            <KpiTile
              label="In the bay"
              value={`${dayBay}/${bayLoad(dayBay).capacity}`}
              detail={
                dayOver
                  ? `${dayOver} over the bay's drop-offs`
                  : "Drop-off slots filled"
              }
            />
            <KpiTile
              label="With Eric"
              value={String(dayEric)}
              detail={dayEric === 1 ? "Job" : "Jobs"}
            />
            <KpiTile
              label="Up next"
              value={upNext ? formatShopTime(upNext.start_at) : "-"}
              detail={
                upNext
                  ? upNext.title
                  : date === todayKey
                    ? "Nothing left today"
                    : "Nothing booked"
              }
            />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_20rem]">
            {(["detailing-bay", "eric"] as const).map((resource) => {
              const appts = byDay
                .get(date)!
                .appts.filter((a) => a.resource === resource);
              const booked = appts.filter((a) => a.status !== "no_show").length;
              return (
                <div key={resource} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-muted-foreground flex-1">
                      {resource === "detailing-bay" ? "Detailing bay" : "Eric"}
                    </h2>
                    {resource === "detailing-bay" ? bayChip(booked) : null}
                  </div>
                  {appts.map((a) => (
                    <AppointmentCard
                      key={a.id}
                      appointment={a}
                      contact={contactOf(a)}
                      detailed
                    />
                  ))}
                  {resource === "detailing-bay"
                    ? Array.from({
                        length: Math.max(0, bayLoad(booked).capacity - booked),
                      }).map((_, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground"
                        >
                          Open drop-off slot (8 to 9 a.m.)
                        </div>
                      ))
                    : null}
                  {resource === "eric" && !appts.length ? (
                    <p className="text-sm text-muted-foreground">
                      Nothing booked with Eric.
                    </p>
                  ) : null}
                </div>
              );
            })}
            {byDay.get(date)!.tasks.length ? (
              <Card className="p-4 lg:col-span-2 xl:col-span-1 gap-1">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Tasks due
                </h2>
                {byDay.get(date)!.tasks.map((t) => (
                  <p key={t.id} className="text-sm">
                    {t.text}
                  </p>
                ))}
              </Card>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={
            isMobile
              ? undefined
              : {
                  gridTemplateColumns: `repeat(${dayKeys.length}, minmax(0, 1fr))`,
                }
          }
        >
          {dayKeys.map((key) => {
            const day = byDay.get(key)!;
            const bay = day.appts.filter(
              (a) => a.resource === "detailing-bay" && a.status !== "no_show",
            ).length;
            return (
              <div key={key} className="flex flex-col gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => go({ date: key, view: "day" })}
                  className={cn(
                    "flex items-center justify-between gap-1 rounded-md px-2 py-1 text-left hover:bg-muted",
                    key === todayKey && "ring-1 ring-primary",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm",
                      key === todayKey
                        ? "font-semibold"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatShopDay(key, { weekday: "short", day: "numeric" })}
                  </span>
                  {bayChip(bay)}
                </button>
                {day.appts.map((a) => (
                  <AppointmentCard
                    key={a.id}
                    appointment={a}
                    contact={contactOf(a)}
                  />
                ))}
                {!day.appts.length ? (
                  <p className="text-xs text-muted-foreground px-2">
                    No bookings
                  </p>
                ) : null}
                <div className="px-2">
                  <DayTasks tasks={day.tasks} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

CalendarPage.path = "/calendar";
