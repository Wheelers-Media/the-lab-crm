import { useDataProvider, useDelete, useNotify, useUpdate } from "ra-core";

import type { CrmDataProvider } from "../providers/types";
import type { Appointment } from "../types";
import { removeKind } from "./editForm";
import { pushToGoogleSoon } from "./useAppointmentActions";

/**
 * Takes a booking off the calendar, with Undo for a few seconds. One made only
 * here is deleted; one that lives in Google or Cal.com is cancelled, which the
 * calendar sync carries to Google (see removeKind).
 */
export const useRemoveAppointment = (appointment: Appointment) => {
  const [update] = useUpdate<Appointment>();
  const [deleteOne] = useDelete<Appointment>();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const kind = removeKind(appointment);

  const remove = () => {
    if (kind === "delete") {
      deleteOne(
        "appointments",
        { id: appointment.id, previousData: appointment },
        {
          mutationMode: "undoable",
          onSuccess: () =>
            notify("Appointment removed", { type: "info", undoable: true }),
          onError: () =>
            notify("Could not remove that. Try again.", { type: "error" }),
        },
      );
      return;
    }
    update(
      "appointments",
      {
        id: appointment.id,
        data: { status: "cancelled" },
        previousData: appointment,
      },
      {
        mutationMode: "undoable",
        onSuccess: () => {
          const calcom = appointment.source === "calcom";
          notify(
            calcom
              ? "Booking cancelled here. Cancel it in Cal.com too so the customer hears."
              : "Appointment cancelled",
            { type: "info", undoable: true },
          );
          if (!calcom) pushToGoogleSoon(dataProvider);
        },
        onError: () =>
          notify("Could not cancel that. Try again.", { type: "error" }),
      },
    );
  };

  return { kind, remove };
};
