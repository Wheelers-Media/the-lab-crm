import type {
  DraggableProvided,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import {
  type Identifier,
  RecordContextProvider,
  useGetManyAggregate,
  useRedirect,
} from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { NumberField } from "@/components/admin/number-field";
import { SelectField } from "@/components/admin/select-field";
import { Card, CardContent } from "@/components/ui/card";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Deal } from "../types";
import { VehicleLabelField } from "../vehicles/VehicleField";
import { WORK_STATUS_LABEL } from "../shopfloor/workStatus";

export const DealCardContent = ({
  provided,
  snapshot,
  deal,
}: {
  provided?: DraggableProvided;
  snapshot?: DraggableStateSnapshot;
  deal: Deal;
}) => {
  const { dealCategories, currency } = useConfigurationContext();
  const redirect = useRedirect();
  const handleClick = () => {
    redirect(`/deals/${deal.id}/show`, undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  return (
    <div
      className="cursor-pointer"
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      ref={provided?.innerRef}
      onClick={handleClick}
    >
      <RecordContextProvider value={deal}>
        <Card
          className={`py-3 transition-all duration-200 ${
            snapshot?.isDragging
              ? "opacity-90 transform rotate-1 shadow-lg"
              : "shadow-sm hover:shadow-md"
          }`}
        >
          <CardContent className="px-3 flex flex-col gap-0.5">
            <div className="flex-1 flex gap-2">
              <p className="flex-1 text-sm font-semibold leading-snug">
                {deal.name}
              </p>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {deal.contact_ids?.length ? (
                <DealCustomerName contactId={deal.contact_ids[0]} />
              ) : null}
              {/* The business by name: a lone initial in a circle said nothing */}
              {deal.contact_ids?.length && deal.company_id ? " · " : null}
              {deal.company_id ? (
                <ReferenceField
                  source="company_id"
                  reference="companies"
                  link={false}
                />
              ) : null}
            </p>
            {deal.vehicle_id ? (
              <p className="text-xs text-muted-foreground truncate">
                <VehicleLabelField />
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              <NumberField
                source="amount"
                options={{
                  style: "currency",
                  currency,
                  currencyDisplay: "narrowSymbol",
                  maximumFractionDigits: 0,
                }}
              />
              {deal.category && ", "}
              <SelectField
                source="category"
                choices={dealCategories}
                optionText="label"
                optionValue="value"
              />
            </p>
            {deal.work_status ? (
              <p>
                <span className="lab-chip lab-chip-bay">
                  {WORK_STATUS_LABEL[deal.work_status]}
                </span>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </RecordContextProvider>
    </div>
  );
};

/** First customer on the job; card lookups are batched into one request. */
const DealCustomerName = ({ contactId }: { contactId: Identifier }) => {
  const { data } = useGetManyAggregate<Contact>("contacts_summary", {
    ids: [contactId],
  });
  const contact = data?.[0];
  return contact ? (
    <>{`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()}</>
  ) : null;
};
