import {
  CalendarDays,
  CalendarX,
  Check,
  ExternalLink,
  RotateCcw,
  UserRound,
  UserX,
} from "lucide-react";
import { useDataProvider, useNotify, useUpdate } from "ra-core";
import { useNavigate } from "react-router";

import { reachActions } from "../contacts/reach";
import type { SheetAction } from "../misc/ActionSheet";
import type { SwipeAction } from "../misc/SwipeRow";
import type { CrmDataProvider } from "../providers/types";
import type { Appointment, AppointmentStatus, Contact } from "../types";

// The undo toast holds a change about five seconds before it is saved, so the
// push to Google waits a little longer than that
const GOOGLE_PUSH_DELAY_MS = 10_000;
let pushTimer: number | undefined;

/**
 * Takes a cancelled booking off Google Calendar soon after, instead of at the
 * next Calendar visit. Outside any component, so the row leaving the screen
 * does not stop it. A failed push is not lost: the next sync, which shows its
 * own errors, makes the same change.
 */
const pushToGoogleSoon = (dataProvider: CrmDataProvider) => {
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    dataProvider.syncGoogleCalendar().catch(() => undefined);
  }, GOOGLE_PUSH_DELAY_MS);
};

const isOpen = (a: Appointment) =>
  a.status === "booked" || a.status === "rescheduled";

/** Started already, so Done and No-show make sense. */
const hasStarted = (a: Appointment, now = Date.now()) =>
  new Date(a.start_at).getTime() <= now;

const MESSAGES: Record<AppointmentStatus, string> = {
  completed: "Marked done",
  no_show: "Marked as no-show",
  cancelled: "Booking cancelled",
  booked: "Back to booked",
  rescheduled: "Marked rescheduled",
};

/**
 * Everything a booking row offers besides opening it: call or text the
 * customer, open their profile or the job, settle the visit, or cancel it.
 * Every change shows an Undo for a few seconds before it is saved.
 */
export const useAppointmentActions = ({
  appointment,
  contact,
  onOpen,
}: {
  appointment: Appointment;
  contact?: Contact | null;
  /** Opens the booking itself; left out of the menu when absent. */
  onOpen?: () => void;
}): {
  actions: SheetAction[];
  swipeLeft?: SwipeAction;
  swipeRight?: SwipeAction;
} => {
  const [update] = useUpdate<Appointment>();
  const notify = useNotify();
  const navigate = useNavigate();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const set = (status: AppointmentStatus) =>
    update(
      "appointments",
      { id: appointment.id, data: { status }, previousData: appointment },
      {
        mutationMode: "undoable",
        onSuccess: () => {
          const calcom =
            status === "cancelled" && appointment.source === "calcom";
          notify(
            calcom
              ? "Booking cancelled here. Cancel it in Cal.com too so the customer hears."
              : MESSAGES[status],
            { type: "info", undoable: true },
          );
          if (status === "cancelled" && appointment.source !== "calcom")
            pushToGoogleSoon(dataProvider);
        },
        onError: () =>
          notify("Could not save that. Try again.", { type: "error" }),
      },
    );

  const open = isOpen(appointment);
  const started = hasStarted(appointment);
  const settled =
    appointment.status === "completed" || appointment.status === "no_show";

  const actions: SheetAction[] = [
    {
      label: "Open booking",
      icon: CalendarDays,
      hidden: !onOpen,
      onSelect: () => onOpen?.(),
    },
    ...reachActions(contact),
    {
      label: "Open customer",
      icon: UserRound,
      hidden: !contact,
      onSelect: () => contact && navigate(`/contacts/${contact.id}/show`),
    },
    {
      label: "Open the job",
      icon: ExternalLink,
      hidden: appointment.deal_id == null,
      onSelect: () => navigate(`/deals/${appointment.deal_id}/show`),
    },
    {
      label: "Mark done",
      icon: Check,
      hidden: !open || !started,
      onSelect: () => set("completed"),
    },
    {
      label: "No-show",
      icon: UserX,
      hidden: !open || !started,
      onSelect: () => set("no_show"),
    },
    {
      label: "Back to booked",
      icon: RotateCcw,
      hidden: !settled,
      onSelect: () => set("booked"),
    },
    {
      label: "Cancel booking",
      icon: CalendarX,
      destructive: true,
      hidden: !open,
      onSelect: () => set("cancelled"),
    },
  ];

  return {
    actions,
    swipeLeft: open
      ? {
          label: "Cancel",
          icon: CalendarX,
          tone: "danger",
          onTrigger: () => set("cancelled"),
        }
      : undefined,
    swipeRight:
      open && started
        ? {
            label: "Done",
            icon: Check,
            tone: "good",
            onTrigger: () => set("completed"),
          }
        : undefined,
  };
};
