import { Check, Clock, Copy, MessageSquare } from "lucide-react";
import {
  useCreate,
  useGetIdentity,
  useGetList,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";

import { firstPhone } from "../contacts/firstPhone";
import { reviewAsk } from "../shopfloor/reviewAsk";
import { smsHref } from "../shopfloor/messageTemplates";
import type { Contact, ContactNote, Order } from "../types";
import {
  askedNote,
  askedOrders,
  nextEveningReminder,
  reviewTiming,
  REVIEW_NOTE_PREFIX,
  wasAsked,
} from "./orderReview";

/** Notes that say a review was asked for, shared by the whole list in one query. */
export const useAskedReviews = (): Set<string> => {
  const { data = [] } = useGetList<ContactNote>("contact_notes", {
    filter: { "text@ilike": `${REVIEW_NOTE_PREFIX}*` },
    sort: { field: "date", order: "DESC" },
    pagination: { page: 1, perPage: 1000 },
  });
  return askedOrders(data.map((n) => n.text));
};

export const useOrderAsked = (order: Pick<Order, "order_number">): boolean =>
  wasAsked(order, useAskedReviews());

/**
 * Ask one customer for a Google review from their order. The text is written
 * in Eric's voice from what they bought and is yours to edit. Nothing is sent
 * automatically: text it now, or park a reminder for 6 p.m. when they are home.
 */
export const ReviewAskDialog = ({
  order,
  onClose,
}: {
  order: Order | null;
  onClose: () => void;
}) => {
  const isMobile = useIsMobile();
  const notify = useNotify();
  const refresh = useRefresh();
  const { data: identity } = useGetIdentity();
  const [create, { isPending }] = useCreate();
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: order?.contact_id ?? 0 },
    { enabled: order?.contact_id != null },
  );
  const [text, setText] = useState("");
  const timing = reviewTiming();
  const phone = contact ? firstPhone(contact) : null;

  useEffect(() => {
    if (!order || !contact) return;
    setText(
      reviewAsk({
        firstName: contact.first_name,
        vehicle: contact.vehicle_label,
        names: (order.line_items ?? []).map((line) => line.name),
        seed: order.order_number,
      }),
    );
  }, [order, contact]);

  if (!order) return null;
  const name = contact?.first_name?.trim() || "the customer";

  const markAsked = () =>
    create(
      "contact_notes",
      {
        data: {
          contact_id: order.contact_id,
          text: askedNote(order),
          date: new Date().toISOString(),
          sales_id: identity?.id,
          status: "cold",
        },
      },
      {
        onSuccess: () => {
          notify(`Marked as asked. ${name} won't show up in the queue again.`);
          refresh();
          onClose();
        },
        onError: () => notify("Could not save that", { type: "error" }),
      },
    );

  const textNow = () => {
    if (!phone) return;
    if (isMobile) {
      window.location.href = smsHref(phone, text);
      return;
    }
    navigator.clipboard
      ?.writeText(text)
      .then(() => notify(`Text copied. Paste it into a message to ${phone}.`))
      .catch(() => notify("Could not copy the text", { type: "error" }));
  };

  const remindTonight = () =>
    create(
      "tasks",
      {
        data: {
          contact_id: order.contact_id,
          type: "text",
          text: `Ask ${name} for a review (order ${order.order_number}). Text is ready on the Orders tab.`,
          due_date: nextEveningReminder().toISOString(),
          sales_id: identity?.id,
        },
      },
      {
        onSuccess: () => {
          notify("Reminder set for 6 p.m. in Tasks.");
          onClose();
        },
        onError: () => notify("Could not set the reminder", { type: "error" }),
      },
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask {name} for a review</DialogTitle>
          <DialogDescription>
            Order {order.order_number} · {phone ?? "no phone number on file"}
          </DialogDescription>
        </DialogHeader>

        <p
          className={`rounded-md border p-2 text-sm ${
            timing.good
              ? "border-[var(--lab-bay,currentColor)]"
              : "border-[var(--lab-amber,currentColor)]"
          }`}
        >
          {timing.label}
        </p>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            The text (edit it if you like)
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-input bg-transparent p-3 text-sm leading-relaxed dark:bg-input/30"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={!phone} onClick={textNow}>
            {isMobile ? (
              <MessageSquare className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {isMobile ? "Text now" : "Copy text"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={timing.good ? "outline" : "secondary"}
            disabled={isPending}
            onClick={() => void remindTonight()}
          >
            <Clock className="size-4" aria-hidden />
            Remind me this evening
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => void markAsked()}
          >
            <Check className="size-4" aria-hidden />
            Mark as asked
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
