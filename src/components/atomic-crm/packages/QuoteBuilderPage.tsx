import { ArrowLeft } from "lucide-react";
import { useGetList, useGetOne, useNotify, useUpdate } from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type {
  Contact,
  Deal,
  DealPackageLine,
  Package,
  Vehicle,
} from "../types";
import { QuoteCheckout } from "./QuoteCheckout";
import { QuoteLines } from "./QuoteLines";
import { QuoteSuggestions } from "./QuoteSuggestions";
import {
  lineFromCatalog,
  quoteContext,
  quoteTotals,
  suggestProducts,
} from "./quoteModel";

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

const SERVICE_NAMES: Record<string, string> = {
  egr: "EGR",
  exhaust: "Exhaust",
  ccv: "CCV",
  tuning: "Tuning",
  coolant: "Coolant",
};

const vehicleName = (v?: Vehicle | null) =>
  v ? [v.year, v.make, v.model, v.engine].filter(Boolean).join(" ") : "";

const useQuoteData = (id?: string) => {
  const { data: deal, isPending } = useGetOne<Deal>(
    "deals",
    { id: id! },
    { enabled: Boolean(id) },
  );
  const contactId = deal?.contact_ids?.[0];
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId! },
    { enabled: contactId != null },
  );
  const { data: vehicle } = useGetOne<Vehicle>(
    "vehicles",
    { id: deal?.vehicle_id ?? 0 },
    { enabled: deal?.vehicle_id != null },
  );
  // Same query as the package picker, so both share one cached catalog
  const { data: catalog = [] } = useGetList<Package>("packages", {
    pagination: { page: 1, perPage: 2000 },
    sort: { field: "title", order: "ASC" },
    filter: { "status@neq": "deleted" },
  });
  return { deal, contact, vehicle, catalog, isPending };
};

/** Build a quote on a job: suggested parts, catalog, labour, totals and the checkout link. */
export const QuoteBuilderPage = () => {
  const { id } = useParams();
  const isMobile = useIsMobile();
  const { deal, contact, vehicle, catalog, isPending } = useQuoteData(id);
  const { dealStages } = useConfigurationContext();
  const notify = useNotify();
  const [update, { isPending: isSaving }] = useUpdate();
  const [lines, setLines] = useState<DealPackageLine[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Start from what is saved on the job, and follow it until edited here
  useEffect(() => {
    if (deal && !isDirty) setLines(deal.packages ?? []);
  }, [deal, isDirty]);

  const edit = (next: DealPackageLine[]) => {
    setLines(next);
    setIsDirty(true);
  };

  const catalogById = useMemo(
    () => new Map(catalog.map((p) => [String(p.id), p])),
    [catalog],
  );
  const ctx = useMemo(
    () => quoteContext({ name: deal?.name, quote: deal?.quote, vehicle }),
    [deal?.name, deal?.quote, vehicle],
  );
  const suggestions = useMemo(
    () => suggestProducts(catalog, ctx),
    [catalog, ctx],
  );
  const addedIds = useMemo(
    () =>
      new Set(
        lines
          .filter((l) => l.package_id != null)
          .map((l) => String(l.package_id)),
      ),
    [lines],
  );
  const totals = quoteTotals(lines);

  const save = () =>
    new Promise<void>((resolve, reject) => {
      if (!deal) return resolve();
      update(
        "deals",
        {
          id: deal.id,
          data: { packages: lines, amount: Math.round(totals.total) },
          previousData: deal,
        },
        {
          mutationMode: "pessimistic",
          onSuccess: () => {
            setIsDirty(false);
            notify("Quote saved", { type: "success" });
            resolve();
          },
          onError: (error) => {
            notify("Could not save the quote. Try again.", { type: "error" });
            reject(error);
          },
        },
      );
    });

  if (isPending || !deal) {
    return (
      <Shell isMobile={isMobile} title="Quote" back="/deals">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Shell>
    );
  }

  const customer = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
    : "";
  const back = contact ? `/contacts/${contact.id}/show` : "/deals";
  const stage = dealStages.find((s) => s.value === deal.stage)?.label;
  const engineShown = vehicle?.engine ? "" : ctx.engine ? `${ctx.engine}L` : "";
  const reason =
    [
      vehicleName(vehicle),
      engineShown,
      ctx.services.map((s) => SERVICE_NAMES[s] ?? s).join(", "),
    ]
      .filter(Boolean)
      .join(" · ") || "Based on the job";

  const totalsCard = (
    <div className="flex flex-col gap-2">
      <dl className="flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Parts</dt>
          <dd className="lab-num">{money(totals.parts)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Labour</dt>
          <dd className="lab-num">{money(totals.labour)}</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd className="lab-num">{money(totals.total)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">Before tax.</p>
      <Button
        type="button"
        onClick={() => save().catch(() => undefined)}
        disabled={!isDirty || isSaving}
        variant={isDirty ? "default" : "outline"}
      >
        {isSaving ? "Saving..." : isDirty ? "Save quote" : "Saved"}
      </Button>
    </div>
  );

  const checkout = (
    <QuoteCheckout
      deal={deal}
      totals={totals}
      isDirty={isDirty}
      onSave={save}
    />
  );

  return (
    <Shell isMobile={isMobile} title={customer || "Quote"} back={back}>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <header className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Quote{stage ? ` · ${stage}` : ""}
            </p>
            <h1 className="text-2xl font-semibold break-words">{deal.name}</h1>
            <p className="text-sm text-muted-foreground">
              {[customer, vehicleName(vehicle)].filter(Boolean).join(" · ")}
            </p>
          </header>

          {deal.quote?.choices?.length ? (
            <details
              className="group rounded-lg border border-border p-3"
              open={!isMobile}
            >
              <summary className="cursor-pointer text-sm font-semibold">
                What they asked for
              </summary>
              <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]">
                {deal.quote.choices.map((c, i) => (
                  <div key={i} className="contents">
                    <dt className="text-muted-foreground">{c.label}</dt>
                    <dd className="mb-1 sm:mb-0">{c.value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ) : null}

          <QuoteSuggestions
            suggestions={suggestions}
            addedIds={addedIds}
            reason={reason}
            hasTruck={Boolean(vehicle)}
            note={
              ctx.platform && !ctx.engine
                ? "Add the truck's engine to the job to see engine-specific parts."
                : undefined
            }
            onAdd={(pkg) => edit([...lines, lineFromCatalog(pkg)])}
          />

          <section
            className="flex flex-col gap-3"
            aria-labelledby="quote-lines"
          >
            <h2 id="quote-lines" className="text-base font-semibold">
              Quote
            </h2>
            <QuoteLines lines={lines} catalog={catalogById} onChange={edit} />
          </section>

          {isMobile ? (
            <>
              <Card className="p-4">{totalsCard}</Card>
              <Card className="p-4">{checkout}</Card>
            </>
          ) : null}
        </div>

        {isMobile ? null : (
          <aside className="sticky top-20 flex flex-col gap-4">
            <Card className="p-4">{totalsCard}</Card>
            <Card className="p-4">{checkout}</Card>
          </aside>
        )}
      </div>
    </Shell>
  );
};

const Shell = ({
  isMobile,
  title,
  back,
  children,
}: {
  isMobile: boolean;
  title: string;
  back: string;
  children: React.ReactNode;
}) =>
  isMobile ? (
    <>
      <MobileHeader>
        <Link to={back} aria-label="Back" className="-ml-1 p-1">
          <ArrowLeft className="size-5" />
        </Link>
        <p className="truncate text-xl font-semibold">{title}</p>
      </MobileHeader>
      <MobileContent>{children}</MobileContent>
    </>
  ) : (
    <div className="mt-2 flex flex-col gap-4">
      <Link
        to={back}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>
      {children}
    </div>
  );

QuoteBuilderPage.path = "/quotes/:id";
