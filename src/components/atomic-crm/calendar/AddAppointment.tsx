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
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
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
import {
  bookingCustomerErrors,
  contactForBooking,
  isNewCustomer,
  NEW_CUSTOMER_DEFAULTS,
  type NewCustomerFields,
} from "./bookingContact";
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

/**
 * A booking needs a customer: one picked from the CRM, or the name and number
 * Eric just took over the phone. Products are saved on that customer's job, so
 * they need a customer too.
 */
const validateBooking = (data: unknown) => {
  const values = data as BookingForm;
  return {
    ...bookingCustomerErrors(values),
    ...(Array.isArray(values.packages) &&
    values.packages.length > 0 &&
    values.contact_id == null &&
    !isNewCustomer(values)
      ? { contact_id: "Pick the customer: products are saved on their job" }
      : {}),
  };
};

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
  /** Minutes into the day the booking starts, as a clicked time slot gives it. */
  time?: string;
  contact_id?: Identifier;
  title?: string;
  vehicle?: string | null;
  resource?: "detailing-bay" | "eric";
  /** The job this booking is for, when opened from one. */
  deal_id?: Identifier;
}

type BookingForm = AppointmentForm &
  NewCustomerFields & {
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
  const queryClient = useQueryClient();

  /** Saves the customer typed into the booking and returns their id. */
  const createBookingCustomer = async (values: BookingForm) => {
    try {
      const { data: contact } = await dataProvider.create<Contact>("contacts", {
        data: contactForBooking(values, identity?.id),
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts_summary"] });
      return contact.id;
    } catch (error) {
      notify("Could not save the new customer. Try again.", { type: "error" });
      throw error;
    }
  };

  /**
   * Products go on the customer's job before the booking is saved, so the
   * booking can point at that job. Without products the booking saves as
   * before and the pipeline links it to a job on its own.
   */
  const transform = async (values: BookingForm) => {
    const appointment = toAppointment(values);
    const contactId = isNewCustomer(values)
      ? await createBookingCustomer(values)
      : (values.contact_id ?? null);
    const withCustomer = { ...appointment, contact_id: contactId };
    const lines = values.packages ?? [];
    if (!lines.length || contactId == null) {
      return values.job_id && values.job_id !== NEW_JOB
        ? { ...withCustomer, deal_id: values.job_id }
        : withCustomer;
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
        return { ...withCustomer, deal_id: job.id };
      }
      const [{ data: contact }, { data: vehicles }] = await Promise.all([
        dataProvider.getOne<Contact>("contacts", { id: contactId }),
        dataProvider.getList<Vehicle>("vehicles", {
          filter: { contact_id: contactId },
          sort: { field: "is_primary", order: "DESC" },
          pagination: { page: 1, perPage: 1 },
        }),
      ]);
      const { data: job } = await dataProvider.create<Deal>("deals", {
        data: newJobForBooking({
          title: values.title,
          contactId,
          companyId: contact.company_id,
          vehicleId: vehicles[0]?.id,
          salesId: identity?.id,
          day: values.day,
          lines,
        }),
      });
      return { ...withCustomer, deal_id: job.id };
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
          ...NEW_CUSTOMER_DEFAULTS,
          resource: defaults.resource ?? "detailing-bay",
          day: defaults.day,
          time: defaults.time ?? "480",
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
              <CustomerFields />
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

/**
 * Who the booking is for: a customer already in the CRM, or a new one Eric is
 * adding while they are on the phone. A new customer is saved when the booking
 * is, so abandoning a half-filled form leaves nothing behind.
 */
const CustomerFields = () => {
  const { setValue } = useFormContext();
  const isNew = useWatch({ name: "new_customer" }) === true;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Who is it for</span>
        <div
          role="group"
          aria-label="Who is it for"
          className="flex rounded-md border border-border p-0.5"
        >
          <Button
            type="button"
            size="sm"
            variant={isNew ? "ghost" : "secondary"}
            aria-pressed={!isNew}
            onClick={() =>
              setValue("new_customer", false, { shouldDirty: true })
            }
          >
            Existing
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isNew ? "secondary" : "ghost"}
            aria-pressed={isNew}
            onClick={() =>
              setValue("new_customer", true, { shouldDirty: true })
            }
          >
            New customer
          </Button>
        </div>
      </div>
      {isNew ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput
            source="customer_first_name"
            label="First name"
            validate={required()}
            helperText={false}
          />
          <TextInput
            source="customer_last_name"
            label="Last name"
            validate={required()}
            helperText={false}
          />
          <TextInput
            source="customer_phone"
            label="Phone"
            helperText="For the booking reminder and job texts."
            className="sm:col-span-2"
          />
        </div>
      ) : (
        <ReferenceInput source="contact_id" reference="contacts_summary">
          <AutocompleteInput
            label="Customer"
            optionText={contactOptionText}
            helperText={false}
            modal
          />
        </ReferenceInput>
      )}
    </div>
  );
};
