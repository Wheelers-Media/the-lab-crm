import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  UserX,
} from "lucide-react";
import { useGetList, useNotify, useUpdate } from "ra-core";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { BAY_SLOTS_PER_DAY } from "../operations/metrics";
import { contactName } from "../operations/format";
import { DepositChip, ResourceChip } from "../operations/OperationsWidgets";
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

type View = "week" | "day";

const VISIBLE = ["booked", "completed", "no_show"];

const useCalendarParams = () => {
  const [params, setParams] = useSearchParams();
  const dateParam = params.get("date");
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : shopDayKey(new Date());
  const view: View = params.get("view") === "day" ? "day" : "week";
  const go = (next: { date?: string; view?: View }) => {
    const p = new URLSearchParams(params);
    p.set("date", next.date ?? date);
    p.set("view", next.view ?? view);
    setParams(p, { replace: true });
  };
  return { date, view, go };
};

const StatusActions = ({ appointment }: { appointment: Appointment }) => {
  const [update, { isPending }] = useUpdate<Appointment>();
  const notify = useNotify();
  if (appointment.status !== "booked") return null;
  const set = (status: Appointment["status"], message: string) =>
    update(
      "appointments",
      { id: appointment.id, data: { status }, previousData: appointment },
      { onSuccess: () => notify(message) },
    );
  return (
    <div className="flex gap-2 mt-2">
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => set("completed", "Marked done")}
      >
        <Check className="w-4 h-4" />
        Done
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => set("no_show", "Marked as no-show")}
      >
        <UserX className="w-4 h-4" />
        No-show
      </Button>
    </div>
  );
};

const AppointmentCard = ({
  appointment,
  contact,
  detailed,
}: {
  appointment: Appointment;
  contact?: Contact;
  detailed?: boolean;
}) => (
  <Card
    className={cn("p-3 gap-1", appointment.status !== "booked" && "opacity-70")}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-semibold lab-num">
        {formatShopTime(appointment.start_at)}
        {detailed ? ` to ${formatShopTime(appointment.end_at)}` : ""}
      </span>
      <ResourceChip resource={appointment.resource} />
    </div>
    <p className="text-sm font-medium leading-snug">{appointment.title}</p>
    {contact ? (
      <Link
        to={`/contacts/${contact.id}/show`}
        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        {contactName(contact)}
      </Link>
    ) : null}
    {appointment.vehicle ? (
      <p className="text-xs text-muted-foreground">{appointment.vehicle}</p>
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
      <p className="text-xs text-muted-foreground whitespace-pre-line mt-1">
        {appointment.notes}
      </p>
    ) : null}
    {detailed ? <StatusActions appointment={appointment} /> : null}
  </Card>
);

const bayChip = (count: number) => (
  <span
    className={cn("lab-chip", count > 0 ? "lab-chip-bay" : "lab-chip-muted")}
  >
    Bay {count}/{BAY_SLOTS_PER_DAY}
    {count >= BAY_SLOTS_PER_DAY ? " full" : ""}
  </span>
);

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

export const CalendarPage = () => {
  const { date, view, go } = useCalendarParams();
  const isMobile = useIsMobile();
  const todayKey = shopDayKey(new Date());
  const monday = mondayOf(date);
  const startKey = view === "day" ? date : monday;
  const endKey = view === "day" ? addDays(date, 1) : addDays(monday, 7);

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
    const days =
      view === "day"
        ? [date]
        : [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(monday, i));
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
    if (view === "day" || i < 5) return true;
    const d = byDay.get(key)!;
    return d.appts.length + d.tasks.length > 0;
  });

  const contactOf = (a: Appointment) =>
    a.contact_id != null ? contactsById.get(a.contact_id) : undefined;

  const step = view === "day" ? 1 : 7;
  const rangeLabel =
    view === "day"
      ? formatShopDay(date, { weekday: "long", month: "long", day: "numeric" })
      : `${formatShopDay(monday, { month: "short", day: "numeric" })} to ${formatShopDay(addDays(monday, 6), { month: "short", day: "numeric" })}`;

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
            <ToggleGroupItem value="week" className="px-3">
              Week
            </ToggleGroupItem>
            <ToggleGroupItem value="day" className="px-3">
              Day
            </ToggleGroupItem>
          </ToggleGroup>
          <AddAppointment defaultDay={date} />
        </div>
      </div>

      {view === "day" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                      length: Math.max(0, BAY_SLOTS_PER_DAY - booked),
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
            <Card className="p-4 lg:col-span-2 gap-1">
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
