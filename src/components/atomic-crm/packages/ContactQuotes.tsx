import { ChevronRight, FileText, KanbanSquare, Plus } from "lucide-react";
import { useGetList } from "ra-core";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

import { isClosedStage } from "../deals/pipelineView";
import { useDealActions } from "../deals/useDealActions";
import { ActionRow } from "../misc/ActionRow";
import type { Contact, Deal } from "../types";
import { quoteTotals } from "./quoteModel";
import { useStartQuote } from "./useStartQuote";

const money = (n: number) =>
  n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

/** What a job's quote stands at, in a few words. */
const quoteStatus = (deal: Deal) => {
  if (deal.checkout)
    return deal.checkout.emailed
      ? "Checkout link emailed"
      : "Checkout link created";
  if (deal.packages?.length)
    return `${money(quoteTotals(deal.packages).total)} quoted`;
  if (deal.quote) return "Website request, needs a quote";
  return "No quote yet";
};

/** One open job: tap for its quote, hold or swipe for the rest. */
const QuoteRow = ({ deal }: { deal: Deal }) => {
  const { actions, swipeLeft, swipeRight, stageLabel } = useDealActions(deal);
  return (
    <li>
      <ActionRow
        title={deal.name}
        subtitle={stageLabel}
        actions={actions}
        swipeLeft={swipeLeft}
        swipeRight={swipeRight}
      >
        <Link
          to={`/quotes/${deal.id}`}
          className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-foreground/40"
        >
          <FileText
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {deal.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {stageLabel ?? deal.stage} · {quoteStatus(deal)}
            </span>
          </span>
          <span className="shrink-0 text-xs uppercase tracking-wider text-[var(--lab-blue-text)]">
            {deal.packages?.length ? "Open quote" : "Build quote"}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </ActionRow>
    </li>
  );
};

/** The new-job form, with this customer (and their business) filled in. */
const newJobLink = (contact: Contact): string =>
  `/deals/create?source=${encodeURIComponent(
    JSON.stringify({
      contact_ids: [contact.id],
      ...(contact.company_id != null ? { company_id: contact.company_id } : {}),
    }),
  )}`;

/**
 * The customer's open jobs with a "Build quote" button on each, and a way to
 * start a new quote or job. Every profile has it, so a sale can start from
 * wherever Eric is looking at the customer.
 */
export const ContactQuotes = ({ contact }: { contact: Contact }) => {
  const { startQuote, isStarting } = useStartQuote();
  const navigate = useNavigate();
  const { data: deals = [], isPending } = useGetList<Deal>("deals", {
    filter: { "contact_ids@cs": `{${contact.id}}`, "archived_at@is": null },
    sort: { field: "updated_at", order: "DESC" },
    pagination: { page: 1, perPage: 20 },
  });
  const open = deals.filter((d) => !isClosedStage(d.stage));
  const closed = deals.length - open.length;

  if (isPending) return null;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="contact-quotes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="contact-quotes"
          className="text-base font-semibold normal-case leading-snug"
        >
          Jobs and quotes
        </h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate(newJobLink(contact))}
          >
            <KanbanSquare className="size-4" />
            New job
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => startQuote(contact)}
            disabled={isStarting}
            className="active:scale-[0.97]"
          >
            <Plus className="size-4" />
            Build quote
          </Button>
        </div>
      </div>
      {open.length ? (
        <ul className="flex flex-col gap-2">
          {open.map((deal) => (
            <QuoteRow key={deal.id} deal={deal} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          No open jobs. Build a quote to price parts and labour, or add a job to
          track it on the board.
        </p>
      )}
      {closed > 0 ? (
        <Link
          to={`/deals?filter=${encodeURIComponent(
            JSON.stringify({ "contact_ids@cs": `{${contact.id}}` }),
          )}`}
          className="self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {closed} past {closed === 1 ? "job" : "jobs"}
        </Link>
      ) : null}
    </section>
  );
};
