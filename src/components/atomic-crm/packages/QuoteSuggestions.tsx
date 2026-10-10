import { Check, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

import type { Package } from "../types";
import { packagePriceLabel } from "./packageModel";
import { ProductThumb, StockChip } from "./ProductList";

/** Parts that fit the truck and match the request, one tap to add. */
export const QuoteSuggestions = ({
  suggestions,
  addedIds,
  onAdd,
  reason,
  hasTruck,
  note,
}: {
  suggestions: Package[];
  addedIds: Set<string>;
  onAdd: (pkg: Package) => void;
  /** Plain words for what the suggestions are based on. */
  reason: string;
  hasTruck: boolean;
  /** Shown when suggestions are held back, saying what would unlock them. */
  note?: string;
}) => (
  <section className="flex flex-col gap-3" aria-labelledby="quote-suggested">
    <div className="flex items-baseline justify-between gap-3">
      <h2
        id="quote-suggested"
        className="flex items-center gap-2 text-base font-semibold"
      >
        <Sparkles className="size-4 text-primary" aria-hidden />
        Suggested for this truck
      </h2>
      <span className="text-xs text-muted-foreground text-right">{reason}</span>
    </div>
    {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    {suggestions.length ? (
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((pkg) => {
          const added = addedIds.has(String(pkg.id));
          return (
            <li
              key={pkg.id}
              className="flex items-center gap-3 rounded-lg border border-border p-2 pr-3"
            >
              <ProductThumb pkg={pkg} size={52} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm leading-snug">{pkg.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm lab-num">
                    {packagePriceLabel(pkg)}
                  </span>
                  <StockChip inventory={pkg.inventory} />
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant={added ? "ghost" : "outline"}
                disabled={added}
                onClick={() => onAdd(pkg)}
                aria-label={added ? `${pkg.title} added` : `Add ${pkg.title}`}
                className="shrink-0"
              >
                {added ? (
                  <Check className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {added ? "Added" : "Add"}
              </Button>
            </li>
          );
        })}
      </ul>
    ) : (
      <p className="text-sm text-muted-foreground">
        {hasTruck
          ? "No catalog parts match this truck and request. Pick from the catalog below."
          : "Add the customer's truck to the job to see parts that fit, or pick from the catalog below."}
      </p>
    )}
  </section>
);
