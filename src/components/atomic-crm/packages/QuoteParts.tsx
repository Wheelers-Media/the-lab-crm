import { Check, Plus, Search, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

import type { Package } from "../types";
import { packagePriceLabel } from "./packageModel";
import { ProductThumb, StockChip } from "./ProductList";
import {
  fitsTruck,
  groupByType,
  searchCatalog,
  type QuoteContext,
} from "./quoteModel";

const GROUP_PREVIEW = 4;

const PartRow = ({
  pkg,
  added,
  fits,
  onAdd,
}: {
  pkg: Package;
  added: boolean;
  fits?: boolean;
  onAdd: (pkg: Package) => void;
}) => (
  <li className="flex items-center gap-3 rounded-lg border border-border p-2 pr-3">
    <ProductThumb pkg={pkg} size={48} />
    <div className="min-w-0 flex-1">
      <p className="line-clamp-2 text-sm leading-snug">{pkg.title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-sm lab-num">{packagePriceLabel(pkg)}</span>
        <StockChip inventory={pkg.inventory} />
        {fits ? (
          <span className="lab-chip lab-chip-bay">Fits this truck</span>
        ) : null}
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
      {added ? <Check className="size-4" /> : <Plus className="size-4" />}
      {added ? "Added" : "Add"}
    </Button>
  </li>
);

const Group = ({
  type,
  items,
  asked,
  addedIds,
  onAdd,
}: {
  type: string;
  items: Package[];
  asked: boolean;
  addedIds: Set<string>;
  onAdd: (pkg: Package) => void;
}) => {
  const [open, setOpen] = useState(asked);
  const shown = open ? items : items.slice(0, GROUP_PREVIEW);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {type}
        <span className="lab-num">{items.length}</span>
        {asked ? (
          <span className="lab-chip lab-chip-parts">Asked for</span>
        ) : null}
      </h3>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {shown.map((pkg) => (
          <PartRow
            key={pkg.id}
            pkg={pkg}
            added={addedIds.has(String(pkg.id))}
            onAdd={onAdd}
          />
        ))}
      </ul>
      {items.length > GROUP_PREVIEW ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto self-start px-0"
          onClick={() => setOpen(!open)}
        >
          {open ? "Show less" : `Show ${items.length - GROUP_PREVIEW} more`}
        </Button>
      ) : null}
    </div>
  );
};

/**
 * Where parts come from: a search over the whole catalog, and below it the
 * parts that fit the truck, grouped by type with the requested types first.
 */
export const QuoteParts = ({
  catalog,
  suggestions,
  ctx,
  addedIds,
  onAdd,
  reason,
  engines,
  onPickEngine,
}: {
  catalog: Package[];
  suggestions: Package[];
  ctx: QuoteContext;
  addedIds: Set<string>;
  onAdd: (pkg: Package) => void;
  /** Plain words for what the suggestions are based on. */
  reason: string;
  /** Engines to choose from when the truck's engine is not known. */
  engines: string[];
  onPickEngine: (engine: string) => void;
}) => {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchCatalog(catalog, query, ctx),
    [catalog, query, ctx],
  );
  const groups = useMemo(
    () => groupByType(suggestions, ctx.services),
    [suggestions, ctx.services],
  );
  const needsEngine = Boolean(ctx.platform && !ctx.engine);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="quote-parts">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="quote-parts" className="text-base font-semibold">
          Add parts
        </h2>
        <span className="text-right text-xs text-muted-foreground">
          {reason}
        </span>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="quote-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search parts by name or SKU"
          aria-label="Search parts by name or SKU"
          className="h-11 w-full rounded-md border border-input bg-transparent pl-9 pr-10 text-base dark:bg-input/30"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {query ? (
        results.length ? (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {results.map((pkg) => (
              <PartRow
                key={pkg.id}
                pkg={pkg}
                added={addedIds.has(String(pkg.id))}
                fits={Boolean(ctx.platform) && fitsTruck(pkg.title, ctx)}
                onAdd={onAdd}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing in the catalog matches "{query}".
          </p>
        )
      ) : (
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden />
            Suggested for this truck
          </p>
          {needsEngine && engines.length ? (
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
              <p className="text-sm">
                Which engine? Parts are made for one engine, so pick it to see
                them.
              </p>
              <div className="flex flex-wrap gap-2">
                {engines.map((engine) => (
                  <Button
                    key={engine}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onPickEngine(engine)}
                  >
                    {engine}L
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          {groups.length ? (
            groups.map((g) => (
              <Group
                key={g.type}
                type={g.type}
                items={g.items}
                asked={g.asked}
                addedIds={addedIds}
                onAdd={onAdd}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {ctx.platform
                ? "No parts in the catalog fit this truck yet. Search above to add anything."
                : "Add the customer's truck to the job to see parts that fit, or search above."}
            </p>
          )}
        </div>
      )}
    </section>
  );
};
