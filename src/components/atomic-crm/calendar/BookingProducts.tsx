import { ChevronDown, Package as PackageIcon } from "lucide-react";
import { type Identifier, useGetList } from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { QuoteLines } from "../packages/QuoteLines";
import { QuoteParts } from "../packages/QuoteParts";
import {
  enginesFor,
  lineFromCatalog,
  quoteContext,
  quoteTotals,
  suggestProducts,
} from "../packages/quoteModel";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal, DealPackageLine, Package } from "../types";
import { likelyJob } from "./bookingJob";

/** The form value for "make a new job" in the job picker. */
export const NEW_JOB = "new";

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

/**
 * Products for a booking, picked the same way as on a quote: suggestions for
 * the truck, a search over the whole catalog, and editable lines with a
 * total. They are saved on the customer's job, so the quote, the booking and
 * the checkout link all show the same thing.
 */
export const BookingProducts = () => {
  const { field } = useController({ name: "packages", defaultValue: [] });
  const { getValues, setValue } = useFormContext();
  const lines: DealPackageLine[] = useMemo(
    () => (Array.isArray(field.value) ? field.value : []),
    [field.value],
  );
  const [title, vehicle, contactId, jobId] = useWatch({
    name: ["title", "vehicle", "contact_id", "job_id"],
  }) as [string?, string?, Identifier?, string?];
  const [open, setOpen] = useState(lines.length > 0);
  const { dealStages } = useConfigurationContext();

  // Same query as the quote builder, so both share one cached catalog
  const { data: catalog = [] } = useGetList<Package>(
    "packages",
    {
      pagination: { page: 1, perPage: 2000 },
      sort: { field: "title", order: "ASC" },
      filter: { "status@neq": "deleted" },
    },
    { enabled: open },
  );
  const { data: jobs = [] } = useGetList<Deal>(
    "deals",
    {
      filter: { "contact_ids@cs": `{${contactId}}`, "archived_at@is": null },
      sort: { field: "updated_at", order: "DESC" },
      pagination: { page: 1, perPage: 20 },
    },
    { enabled: contactId != null },
  );
  const openJobs = jobs.filter((d) => d.stage !== "won" && d.stage !== "lost");

  // Point at the customer's open job, until someone picks one by hand (or the
  // form was opened from a job)
  const [jobPicked, setJobPicked] = useState(() =>
    Boolean(getValues("job_id")),
  );
  const suggested = likelyJob(openJobs);
  useEffect(() => {
    if (jobPicked) return;
    setValue(
      "job_id",
      contactId != null && suggested != null ? String(suggested) : NEW_JOB,
    );
  }, [contactId, suggested, jobPicked, setValue]);

  const [pickedEngine, setPickedEngine] = useState<string | null>(null);
  const ctx = useMemo(() => {
    const base = quoteContext({
      name: [title, vehicle].filter(Boolean).join("\n"),
    });
    return pickedEngine && !base.engine
      ? { ...base, engine: pickedEngine }
      : base;
  }, [title, vehicle, pickedEngine]);
  const engines = useMemo(
    () => enginesFor(catalog, ctx.platform),
    [catalog, ctx.platform],
  );
  const suggestions = useMemo(
    () => (open ? suggestProducts(catalog, ctx) : []),
    [catalog, ctx, open],
  );
  const catalogById = useMemo(
    () => new Map(catalog.map((p) => [String(p.id), p])),
    [catalog],
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
  const stageName = (stage: string) =>
    dealStages.find((s) => s.value === stage)?.label ?? stage;

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        <PackageIcon className="size-4" />
        Add products
      </Button>
    );
  }

  return (
    <section
      className="flex flex-col gap-4 border-t border-border pt-4 sm:rounded-lg sm:border sm:p-3"
      aria-labelledby="booking-products"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id="booking-products" className="text-base font-semibold">
          Products
        </h3>
        {lines.length ? (
          <span className="text-sm lab-num">
            {money(totals.total)}{" "}
            <span className="text-muted-foreground">before tax</span>
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            <ChevronDown className="size-4 rotate-180" />
            Hide
          </Button>
        )}
      </div>

      {lines.length ? (
        <QuoteLines
          lines={lines}
          catalog={catalogById}
          onChange={field.onChange}
        />
      ) : null}

      {lines.length ? (
        contactId == null ? (
          <p role="alert" className="text-sm text-destructive">
            Pick the customer above: products are saved on their job.
          </p>
        ) : (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Save on</span>
            <Select
              value={jobId ?? NEW_JOB}
              onValueChange={(value) => {
                setJobPicked(true);
                setValue("job_id", value);
              }}
            >
              <SelectTrigger className="w-full" aria-label="Save on job">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_JOB}>
                  A new job for this booking
                </SelectItem>
                {openJobs.map((job) => (
                  <SelectItem key={job.id} value={String(job.id)}>
                    {job.name} ({stageName(job.stage)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )
      ) : null}

      <QuoteParts
        catalog={catalog}
        suggestions={suggestions}
        ctx={ctx}
        addedIds={addedIds}
        reason={vehicle?.trim() || "Search the catalog"}
        engines={engines}
        onPickEngine={setPickedEngine}
        heading="Add products"
        onAdd={(pkg) => {
          field.onChange([...lines, lineFromCatalog(pkg)]);
          // The first product names the booking when nothing was typed
          if (!getValues("title")?.trim())
            setValue("title", pkg.title, { shouldDirty: true });
        }}
      />
    </section>
  );
};
