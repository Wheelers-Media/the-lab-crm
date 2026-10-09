import { Plus } from "lucide-react";
import { CreateBase, Form, required, useNotify } from "ra-core";
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

export const AddAppointment = ({ defaultDay }: { defaultDay: string }) => {
  const [open, setOpen] = useState(false);
  const notify = useNotify();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" />
        Add appointment
      </Button>
      <CreateBase
        resource="appointments"
        record={{
          resource: "detailing-bay",
          day: defaultDay,
          time: "480",
          duration: "60",
          deposit_paid: false,
        }}
        transform={(values: AppointmentForm) => toAppointment(values)}
        redirect={false}
        mutationOptions={{
          onSuccess: () => {
            setOpen(false);
            notify("Appointment added");
          },
        }}
      >
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
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
