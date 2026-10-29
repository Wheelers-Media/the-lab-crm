import { Plus } from "lucide-react";
import {
  CreateBase,
  Form,
  type Identifier,
  type RaRecord,
  required,
  useDataProvider,
  useGetIdentity,
  useNotify,
} from "ra-core";
import { useState } from "react";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { DateInput } from "@/components/admin/date-input";
import { SaveButton } from "@/components/admin/form";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { contactOptionText } from "../misc/ContactOption";
import type {
  Appointment,
  Contact,
  Deal,
  DealPackageLine,
  Vehicle,
} from "../types";
import { jobPatchForBooking, newJobForBooking } from "./bookingJob";
import { BookingProducts, NEW_JOB } from "./BookingProducts";
import { type AppointmentForm, toAppointment } from "./toAppointment";

// Times on the shop clock, 7:00 to 18:00 every half hour
const TIME_CHOICES = Array.from({ length: 23 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const label = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}`;
  return { id: String(minutes), name: label };
});

const DURATION_CHOICES = [
  { id: "30", name: "30 minutes" },
  { id: "60", name: "1 hour" },
  { id: "120", name: "2 hours" },
  { id: "240", name: "Half day" },
  { id: "480", name: "Full day" },
];

const RESOURCE_CHOICES = [
  { id: "detailing-bay", name: "Detailing bay (drop-off)" },
  { id: "eric", name: "Eric (tint, lighting, tuning, installs)" },
];

/** Products are saved on the customer's job, so they need a customer. */
const validateBooking = (values: Record<string, unknown>) =>
  Array.isArray(values.packages) &&
  values.packages.length > 0 &&
  values.contact_id == null
    ? { contact_id: "Pick the customer: products are saved on their job" }
    : {};

export const AddAppointment = ({ defaultDay }: { defaultDay: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" />
        Add appointment
      </Button>
      <AppointmentCreateDialog
        open={open}
        onOpenChange={setOpen}
        defaults={{ day: defaultDay }}
      />
    </>
  );
};

export interface AppointmentDefaults {
  day: string;
  contact_id?: Identifier;
  title?: string;
  vehicle?: string | null;
  resource?: "detailing-bay" | "eric";
  /** The job this booking is for, when opened from one. */
  deal_id?: Identifier;
}

type BookingForm = AppointmentForm & {
  packages?: DealPackageLine[];
  job_id?: string;
};

/**
 * The booking form on its own, so a customer's profile can open it with the
 * customer, their truck and the service already filled in.
 */
export const AppointmentCreateDialog = ({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults: AppointmentDefaults;
}) => {
  const notify = useNotify();
  const setOpen = onOpenChange;
  const dataProvider = useDataProvider();
  const { identity } = useGetIdentity();

  /**
   * Products go on the customer's job before the booking is saved, so the
   * booking can point at that job. Without products the booking saves as
   * before and the pipeline links it to a job on its own.
   */
  const transform = async (values: BookingForm) => {
    const appointment = toAppointment(values);
    const lines = values.packages ?? [];
    if (!lines.length || values.contact_id == null) {
      return values.job_id && values.job_id !== NEW_JOB
        ? { ...appointment, deal_id: values.job_id }
        : appointment;
    }
    try {
      if (values.job_id && values.job_id !== NEW_JOB) {
        const { data: job } = await dataProvider.getOne<Deal>("deals", {
          id: values.job_id,
        });
        await dataProvider.update<Deal>("deals", {
          id: job.id,
          data: jobPatchForBooking(job, lines),
          previousData: job,
        });
        return { ...appointment, deal_id: job.id };
      }
      const [{ data: contact }, { data: vehicles }] = await Promise.all([
        dataProvider.getOne<Contact>("contacts", { id: values.contact_id }),
        dataProvider.getList<Vehicle>("vehicles", {
          filter: { contact_id: values.contact_id },
          sort: { field: "is_primary", order: "DESC" },
          pagination: { page: 1, perPage: 1 },
        }),
      ]);
      const { data: job } = await dataProvider.create<Deal>("deals", {
        data: newJobForBooking({
          title: values.title,
          contactId: values.contact_id,
          companyId: contact.company_id,
          vehicleId: vehicles[0]?.id,
          salesId: identity?.id,
          day: values.day,
          lines,
        }),
      });
      return { ...appointment, deal_id: job.id };
    } catch (error) {
      notify("Could not save the products on the job. Try again.", {
        type: "error",
      });
      throw error;
    }
  };

  return (
    <>
      <CreateBase
        resource="appointments"
        record={{
          resource: defaults.resource ?? "detailing-bay",
          day: defaults.day,
          time: "480",
          duration: "60",
          deposit_paid: false,
          contact_id: defaults.contact_id,
          title: defaults.title,
          vehicle: defaults.vehicle ?? undefined,
          packages: [],
          job_id:
            defaults.deal_id != null ? String(defaults.deal_id) : undefined,
        }}
        transform={transform}
        redirect={false}
        mutationOptions={{
          onSuccess: (booking: RaRecord) => {
            setOpen(false);
            notify(
              (booking as Partial<Appointment>).deal_id != null
                ? "Appointment added, products saved on the job"
                : "Appointment added",
            );
          },
        }}
      >
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="lg:max-w-2xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4" validate={validateBooking}>
              <DialogHeader>
                <DialogTitle>Add appointment</DialogTitle>
                <DialogDescription>
                  For phone and walk-in bookings. Cal.com bookings are added
                  automatically. Times are Fort St. John time.
                </DialogDescription>
              </DialogHeader>
              <ReferenceInput source="contact_id" reference="contacts_summary">
                <AutocompleteInput
                  label="Customer"
                  optionText={contactOptionText}
                  helperText={false}
                  modal
                />
              </ReferenceInput>
              <TextInput
                source="title"
                label="Service"
                validate={required()}
                helperText={false}
                placeholder="Ceramic tint, crew cab"
              />
              <TextInput
                source="vehicle"
                label="Vehicle"
                helperText={false}
                placeholder="2022 Ford F-350"
              />
              <SelectInput
                source="resource"
                label="Who or where"
                choices={RESOURCE_CHOICES}
                validate={required()}
                helperText={false}
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <DateInput
                  source="day"
                  label="Day"
                  validate={required()}
                  helperText={false}
                />
                <SelectInput
                  source="time"
                  label="Time"
                  choices={TIME_CHOICES}
                  validate={required()}
                  helperText={false}
                />
                <SelectInput
                  source="duration"
                  label="Length"
                  choices={DURATION_CHOICES}
                  validate={required()}
                  helperText={false}
                />
              </div>
              <BookingProducts />
              <BooleanInput source="deposit_paid" label="$50 deposit paid" />
              <TextInput
                source="notes"
                label="Notes"
                multiline
                rows={3}
                helperText={false}
              />
              <DialogFooter className="w-full justify-end">
                <SaveButton label="Add appointment" />
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </CreateBase>
    </>
  );
};
