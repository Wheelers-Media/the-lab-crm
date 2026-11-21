import { AlertTriangle, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

import type { DealPackageLine, Package } from "../types";
import {
  type BumperRequest,
  bumperName,
  finishVariant,
  gridironForTruck,
} from "./gridironModel";
import type { QuoteContext } from "./quoteModel";
import { PartRow } from "./QuoteParts";

const PREVIEW = 4;

const FINISH_LABEL: Record<NonNullable<BumperRequest["finish"]>, string> = {
  black: "Black powder coat",
  "custom colour": "Custom colour",
  "bed liner": "Bed liner",
};

/**
 * The Gridiron bumper the customer asked for, first on the quote: the exact
 * listing when the store has it (on the finish they picked), the other
 * Gridiron parts that fit the truck, and a clear way forward when the store
 * has no listing for this truck yet.
 */
export const GridironPanel = ({
  request,
  ctx,
  truck,
  catalog,
  addedIds,
  onAdd,
  onAddLine,
}: {
  request: BumperRequest;
  ctx: QuoteContext;
  /** "2023 Ford F350", for the notice and a custom line. */
  truck: string;
  catalog: Package[];
  addedIds: Set<string>;
  onAdd: (pkg: Package, variantId?: string) => void;
  onAddLine: (line: DealPackageLine) => void;
}) => {
  const [showAll, setShowAll] = useState(false);
  const { fits, exact } = useMemo(
    () => gridironForTruck(catalog, ctx, request),
    [catalog, ctx, request],
  );
  const others = fits.filter((p) => p !== exact);
  const shown = showAll ? others : others.slice(0, PREVIEW);
  const wanted = bumperName(request);
  const isSpecific = Boolean(request.position && request.style);
  const knowsTruck = ctx.year != null && Boolean(ctx.model.trim());

  const customLine = (): DealPackageLine => ({
    package_id: null,
    title: [
      `Gridiron ${wanted}`,
      truck,
      request.finish ? FINISH_LABEL[request.finish] : "",
    ]
      .filter(Boolean)
      .join(" - "),
    price: 0,
    quantity: 1,
    kind: "part",
  });

  return (
    <section
      aria-labelledby="gridiron-panel"
      className="flex flex-col gap-3 rounded-lg border border-border p-3"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Asked for
        </p>
        <h2 id="gridiron-panel" className="text-base font-semibold">
          Gridiron {wanted}
        </h2>
        {request.summary ? (
          <p className="text-sm text-muted-foreground">{request.summary}</p>
        ) : null}
      </div>

      {!knowsTruck ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          Add the truck's year, make and model to the job to match Gridiron
          bumpers.
        </p>
      ) : exact ? (
        <ul className="flex flex-col gap-2">
          <PartRow
            pkg={exact}
            added={addedIds.has(String(exact.id))}
            fits
            initialVariantId={finishVariant(exact, request.finish)}
            onAdd={onAdd}
          />
        </ul>
      ) : isSpecific ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-lg border border-amber-500/60 bg-amber-500/10 p-3 text-sm"
        >
          <p className="flex gap-2">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-[var(--lab-amber)]"
              aria-hidden
            />
            <span>
              The store has no Gridiron {wanted} listed for a {truck} yet.
              Anything Gridiron sells we can order: add it to the quote and
              enter the price once Gridiron confirms it.
            </span>
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-auto min-h-9 self-start whitespace-normal text-left"
            onClick={() => onAddLine(customLine())}
          >
            <Plus className="size-4 shrink-0" aria-hidden />
            Add it to the quote
          </Button>
        </div>
      ) : null}

      {others.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
            {exact || isSpecific
              ? "More Gridiron for this truck"
              : "Gridiron for this truck"}{" "}
            <span className="lab-num">{others.length}</span>
          </h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {shown.map((pkg) => (
              <PartRow
                key={pkg.id}
                pkg={pkg}
                added={addedIds.has(String(pkg.id))}
                fits
                initialVariantId={finishVariant(pkg, request.finish)}
                onAdd={onAdd}
              />
            ))}
          </ul>
          {others.length > PREVIEW ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto self-start px-0"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show less" : `Show ${others.length - PREVIEW} more`}
            </Button>
          ) : null}
        </div>
      ) : knowsTruck && !exact && !isSpecific ? (
        <p className="text-sm text-muted-foreground">
          No Gridiron listings for a {truck} in the store yet. Search below, or
          add a line to the quote and enter the price once Gridiron confirms it.
        </p>
      ) : null}
    </section>
  );
};
