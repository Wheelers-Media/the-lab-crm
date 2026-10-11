import { ChevronRight, FileText, Plus } from "lucide-react";
import { useGetList } from "ra-core";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

import { isClosedStage } from "../deals/pipelineView";
import { useConfigurationContext } from "../root/ConfigurationContext";
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

/**
 * The customer's open jobs with a "Build quote" button on each, and a way to
 * start a new quote. This is where Eric builds the quote from an intake.
 */
export const ContactQuotes = ({ contact }: { contact: Contact }) => {
  const { dealStages } = useConfigurationContext();
  const { startQuote, isStarting } = useStartQuote();
  const { data: deals = [], isPending } = useGetList<Deal>("deals", {
    filter: { "contact_ids@cs": `{${contact.id}}`, "archived_at@is": null },
    sort: { field: "updated_at", order: "DESC" },
    pagination: { page: 1, perPage: 20 },
  });
  const open = deals.filter((d) => !isClosedStage(d.stage));

  if (isPending) return null;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="contact-quotes">
      <div className="flex items-center justify-between gap-2">
        <h3 id="contact-quotes" className="text-base font-semibold">
          Quotes
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => startQuote(contact)}
          disabled={isStarting}
        >
          <Plus className="size-4" />
          New quote
        </Button>
      </div>
      {open.length ? (
        <ul className="flex flex-col gap-2">
          {open.map((deal) => (
            <li key={deal.id}>
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
                    {dealStages.find((s) => s.value === deal.stage)?.label ??
                      deal.stage}{" "}
                    · {quoteStatus(deal)}
                  </span>
                </span>
                <span className="shrink-0 text-xs uppercase tracking-wider text-primary">
                  {deal.packages?.length ? "Open quote" : "Build quote"}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No open jobs. Start a new quote to price parts and labour.
        </p>
      )}
    </section>
  );
};
