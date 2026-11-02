import { useDataProvider, useNotify, useUpdate } from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { CrmDataProvider } from "../providers/types";
import type { Appointment } from "../types";
import {
  type EditValues,
  patchFrom,
  problemWith,
  valuesFrom,
} from "./editForm";
import { pushToGoogleSoon } from "./useAppointmentActions";

const clock = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}`;
};

/** Every quarter hour from 6 a.m. to 8 p.m., plus the booking's own time if it falls between. */
const startChoices = (current: string) => {
  const ids = new Set<number>(
    Array.from({ length: 57 }, (_, i) => 6 * 60 + i * 15),
  );
  ids.add(Number(current));
  return [...ids].sort((a, b) => a - b);
};

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 480];
const durationLabel = (min: number) =>
  min % 60 === 0
    ? `${min / 60} ${min === 60 ? "hour" : "hours"}`
    : min < 60
      ? `${min} minutes`
      : `${Math.floor(min / 60)} h ${min % 60} min`;

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="flex min-w-0 flex-col gap-1">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    {children}
  </label>
);

/** Change a booking: what it is, when, the car, the notes, and the deposit. */
export const EditAppointment = ({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: Appointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [values, setValues] = useState<EditValues>(() =>
    valuesFrom(appointment),
  );
  const [update, { isPending }] = useUpdate<Appointment>();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const set = (patch: Partial<EditValues>) =>
    setValues((v) => ({ ...v, ...patch }));
  const problem = problemWith(values);

  const patch = patchFrom(values);
  const moved =
    patch.start_at !== new Date(appointment.start_at).toISOString() ||
    patch.end_at !== new Date(appointment.end_at).toISOString();
  const calcom = appointment.source === "calcom";

  const save = () => {
    if (problem) return;
    update(
      "appointments",
      { id: appointment.id, data: patch, previousData: appointment },
      {
        mutationMode: "pessimistic",
        onSuccess: () => {
          notify("Appointment updated");
          if (!calcom) pushToGoogleSoon(dataProvider);
          onOpenChange(false);
        },
        onError: () =>
          notify("Could not save that. Try again.", { type: "error" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-9/10 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit appointment</DialogTitle>
          <DialogDescription>
            Times are Fort St. John time.
            {calcom
              ? " This came from Cal.com: a new time here does not move it there, so reschedule it in Cal.com too."
              : ""}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Field label="Title">
            <Input
              value={values.title}
              onChange={(e) => set({ title: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label="Calendar">
            <select
              className={selectClass}
              value={values.resource}
              onChange={(e) =>
                set({ resource: e.target.value as EditValues["resource"] })
              }
            >
              <option value="detailing-bay">Detailing bay (drop-off)</option>
              <option value="eric">
                Eric (tint, lighting, tuning, installs)
              </option>
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Day">
              <Input
                type="date"
                value={values.day}
                onChange={(e) => set({ day: e.target.value })}
              />
            </Field>
            <Field label="Starts">
              <select
                className={selectClass}
                value={values.start}
                onChange={(e) => set({ start: e.target.value })}
              >
                {startChoices(values.start).map((m) => (
                  <option key={m} value={m}>
                    {clock(m)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Length">
              <select
                className={selectClass}
                value={values.duration}
                onChange={(e) => set({ duration: e.target.value })}
              >
                {[...new Set([...DURATIONS, Number(values.duration)])]
                  .sort((a, b) => a - b)
                  .map((m) => (
                    <option key={m} value={m}>
                      {durationLabel(m)}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <Field label="Vehicle">
            <Input
              value={values.vehicle}
              onChange={(e) => set({ vehicle: e.target.value })}
              placeholder="2022 Ram 3500"
            />
          </Field>
          <Field label="Notes">
            <Textarea
              rows={4}
              value={values.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Anything to remember about this booking"
            />
          </Field>
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={values.deposit_paid}
              onCheckedChange={(v) => set({ deposit_paid: v === true })}
              className="size-5 !min-h-0 !min-w-0"
            />
            $50 deposit paid
          </label>
          {moved && calcom ? (
            <p className="text-xs text-[var(--lab-amber)]">
              Remember to move it in Cal.com as well.
            </p>
          ) : null}
          {problem ? (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={Boolean(problem) || isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
