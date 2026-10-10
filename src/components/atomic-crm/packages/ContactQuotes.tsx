import { ChevronRight, FileText, Plus } from "lucide-react";
import { useCreate, useGetIdentity, useGetList, useNotify } from "ra-core";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

import { isClosedStage } from "../deals/pipelineView";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Deal, Vehicle } from "../types";
import { quoteTotals } from "./quoteModel";

const money = (n: number) =>
  n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

const IN_TWO_WEEKS = () =>
  new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
  const { identity } = useGetIdentity();
  const navigate = useNavigate();
  const notify = useNotify();
  const [create, { isPending: isCreating }] = useCreate<Deal>();
  const { data: deals = [], isPending } = useGetList<Deal>("deals", {
    filter: { "contact_ids@cs": `{${contact.id}}`, "archived_at@is": null },
    sort: { field: "updated_at", order: "DESC" },
    pagination: { page: 1, perPage: 20 },
  });
  const { data: vehicles = [] } = useGetList<Vehicle>("vehicles", {
    filter: { contact_id: contact.id },
    sort: { field: "is_primary", order: "DESC" },
    pagination: { page: 1, perPage: 1 },
  });
  const open = deals.filter((d) => !isClosedStage(d.stage));

  const startQuote = () => {
    const name = [contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(" ");
    create(
      "deals",
      {
        data: {
          name: `Quote - ${name || "customer"}`,
          contact_ids: [contact.id],
          company_id: contact.company_id ?? undefined,
          stage: "qualified",
          amount: 0,
          index: 0,
          sales_id: identity?.id,
          expected_closing_date: IN_TWO_WEEKS(),
          vehicle_id: vehicles[0]?.id ?? null,
          packages: [],
        },
      },
      {
        onSuccess: (deal) => navigate(`/quotes/${deal.id}`),
        onError: () =>
          notify("Could not start the quote. Try again.", { type: "error" }),
      },
    );
  };

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
          onClick={startQuote}
          disabled={isCreating}
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
