import { MessageSquare, Star } from "lucide-react";
import { useNotify } from "ra-core";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

import { smsHref } from "../shopfloor/messageTemplates";
import type { Contact } from "../types";
import { firstPhone } from "./firstPhone";
import { reviewAskFor } from "./reviewModel";
import { useCustomerHistory } from "./useCustomerHistory";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/**
 * The review ask on a customer's profile: the text is already written from
 * their most recent order, picked-up job or kept appointment, so the button
 * only has to open Messages with it filled in (or copy it on a computer).
 * Nothing shows once their last visit is more than a month old.
 */
export const ReviewAskCard = ({ contact }: { contact: Contact }) => {
  const history = useCustomerHistory(contact.id);
  const notify = useNotify();
  const isMobile = useIsMobile();
  const phone = firstPhone(contact);

  const ask = useMemo(
    () =>
      reviewAskFor({
        firstName: contact.first_name,
        vehicle: contact.vehicle_label,
        orders: history.orders,
        appointments: history.appointments,
        deals: history.deals,
      }),
    [
      contact.first_name,
      contact.vehicle_label,
      history.orders,
      history.appointments,
      history.deals,
    ],
  );

  if (history.isPending || !ask) return null;

  const send = () => {
    if (!phone) return;
    if (isMobile) {
      window.location.href = smsHref(phone, ask.text);
      return;
    }
    navigator.clipboard
      ?.writeText(ask.text)
      .then(() =>
        notify(`Review text copied. Paste it into a message to ${phone}.`),
      )
      .catch(() => notify("Could not copy the text", { type: "error" }));
  };

  return (
    <section
      aria-labelledby="review-ask"
      className="rounded-lg border border-border p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="review-ask"
          className="flex items-center gap-2 text-base font-semibold normal-case leading-snug"
        >
          <Star className="size-4 text-[var(--lab-amber)]" aria-hidden />
          Ask for a review
        </h2>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!phone}
          onClick={send}
          title={phone ? undefined : "No phone number on file"}
          className="shrink-0 active:scale-[0.97]"
        >
          <MessageSquare className="size-4" aria-hidden />
          {isMobile ? "Text it" : "Copy text"}
        </Button>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {/^order\b/i.test(ask.what) ? "From their" : "From"} {ask.what},{" "}
        {shortDate(ask.at)} · {phone ?? "no phone number on file"}
      </p>
      <p className="mt-2 whitespace-pre-line rounded-md bg-muted/60 p-3 text-sm leading-relaxed text-muted-foreground">
        {ask.text}
      </p>
    </section>
  );
};
