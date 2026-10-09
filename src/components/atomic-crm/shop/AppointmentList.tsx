import { useTranslate } from "ra-core";
import { DataTable } from "@/components/admin/data-table";
import { DateField } from "@/components/admin/date-field";
import { List } from "@/components/admin/list";
import { QuickFilter } from "./QuickFilter";
import { Badge } from "@/components/ui/badge";

import { TopToolbar } from "../layout/TopToolbar";
import type { Appointment, AppointmentStatus } from "../types";
import { ContactLink } from "./ContactLink";
import { todayDate } from "./shopFormat";

const RESOURCE_LABELS: Record<Appointment["resource"], string> = {
  "detailing-bay": "Detailing bay",
  eric: "Eric",
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: "Booked",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No-show",
};

const AppointmentListActions = ({
  upcoming,
}: {
  upcoming: Record<string, unknown>;
}) => {
  const translate = useTranslate();
  return (
    <TopToolbar>
      <QuickFilter
        label={translate("resources.appointments.filters.upcoming", {
          _: "Upcoming",
        })}
        value={upcoming}
      />
      <QuickFilter
        label={translate("resources.appointments.filters.deposit_unpaid", {
          _: "Deposit unpaid",
        })}
        value={{ deposit_paid: false, status: "booked" }}
      />
    </TopToolbar>
  );
};

export const AppointmentList = () => {
  const translate = useTranslate();
  const upcoming = { "start_at@gte": todayDate() };
  return (
    <List
      actions={<AppointmentListActions upcoming={upcoming} />}
      filterDefaultValues={upcoming}
      sort={{ field: "start_at", order: "ASC" }}
      perPage={50}
    >
      <DataTable<Appointment> bulkActionButtons={false} rowClick={false}>
        <DataTable.Col<Appointment>
          source="start_at"
          label="resources.appointments.fields.start_at"
        >
          <DateField
            source="start_at"
            showTime
            options={{
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }}
          />
        </DataTable.Col>
        <DataTable.Col<Appointment>
          source="title"
          label="resources.appointments.fields.title"
        />
        <DataTable.Col<Appointment>
          label="resources.appointments.fields.contact_id"
          disableSort
        >
          <ContactLink />
        </DataTable.Col>
        <DataTable.Col<Appointment>
          source="vehicle"
          label="resources.appointments.fields.vehicle"
        />
        <DataTable.Col<Appointment>
          source="resource"
          label="resources.appointments.fields.resource"
          render={(a) =>
            translate(`resources.appointments.resources.${a.resource}`, {
              _: RESOURCE_LABELS[a.resource] ?? a.resource,
            })
          }
        />
        <DataTable.Col<Appointment>
          source="deposit_paid"
          label="resources.appointments.fields.deposit_paid"
          render={(a) =>
            a.deposit_paid ? (
              <Badge variant="outline">
                {translate("resources.appointments.deposit.paid", {
                  _: "Paid",
                })}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-[#FF8A1F]">
                {translate("resources.appointments.deposit.unpaid", {
                  _: "Not paid",
                })}
              </Badge>
            )
          }
        />
        <DataTable.Col<Appointment>
          source="status"
          label="resources.appointments.fields.status"
          render={(a) =>
            translate(`resources.appointments.statuses.${a.status}`, {
              _: STATUS_LABELS[a.status] ?? a.status,
            })
          }
        />
      </DataTable>
    </List>
  );
};
