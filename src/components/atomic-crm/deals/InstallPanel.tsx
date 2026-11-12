import { PackageCheck } from "lucide-react";
import { useCreate, useGetOne, useNotify, useUpdate } from "ra-core";

import { Button } from "@/components/ui/button";

import { TextCustomerMenu } from "../shopfloor/TextCustomerMenu";
import type { Contact, Deal } from "../types";

/**
 * Install jobs wait in "Parts on the way" until the parts reach the shop.
 * "Parts arrived" moves the job to "Ready to book" and adds a task to text the
 * customer; the Text button then fills in the message with the booking link.
 * The CRM never sends anything itself: a person taps send.
 */
export const InstallPanel = ({ deal }: { deal: Deal }) => {
  const notify = useNotify();
  const [update, { isPending: isMoving }] = useUpdate<Deal>();
  const [create] = useCreate();
  const contactId = deal.contact_ids?.[0];
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId },
    { enabled: contactId != null },
  );

  if (deal.stage !== "parts_on_the_way" && deal.stage !== "ready_to_book")
    return null;

  const partsArrived = () =>
    update(
      "deals",
      {
        id: deal.id,
        data: { stage: "ready_to_book" },
        previousData: deal,
      },
      {
        onSuccess: () => {
          if (contactId != null)
            create("tasks", {
              data: {
                contact_id: contactId,
                type: "text",
                text: `Parts arrived: text the customer the install booking link (${deal.name})`,
                due_date: new Date().toISOString(),
              },
            });
          notify(
            "Moved to Ready to book. Text the customer the booking link.",
            {
              type: "info",
            },
          );
        },
        onError: () =>
          notify("Could not save that. Try again.", { type: "error" }),
      },
    );

  return (
    <div className="my-4 sm:m-4 rounded-md border p-3 flex flex-col gap-2">
      {deal.stage === "parts_on_the_way" ? (
        <>
          <p className="text-sm">
            Parts are paid for and on the way to the shop. No deposit is needed.
          </p>
          <Button
            onClick={partsArrived}
            disabled={isMoving}
            className="min-h-11"
          >
            <PackageCheck className="size-4" />
            Parts arrived
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm">
            Parts are here. Text the customer so they can pick an install day.
          </p>
          <TextCustomerMenu deal={deal} contact={contact} size="default" />
        </>
      )}
    </div>
  );
};
