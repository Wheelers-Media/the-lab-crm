import { Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { DealPackageLine, Package } from "../types";
import { PackagePicker } from "./PackagePicker";
import { ProductThumb } from "./ProductList";
import { lineFromCatalog, lineKind, type LineKind } from "./quoteModel";

const KINDS: Array<[LineKind, string]> = [
  ["part", "Part"],
  ["labour", "Labour"],
];

/** Part / Labour switch; parts are paid up front, labour can wait for pickup. */
const KindSwitch = ({
  value,
  onChange,
  label,
}: {
  value: LineKind;
  onChange: (kind: LineKind) => void;
  label: string;
}) => (
  <div
    role="radiogroup"
    aria-label={`${label}: part or labour`}
    className="inline-flex rounded-md border border-border p-0.5"
  >
    {KINDS.map(([kind, text]) => (
      <button
        key={kind}
        type="button"
        role="radio"
        aria-checked={value === kind}
        onClick={() => onChange(kind)}
        className={`h-8 min-w-16 rounded-sm px-2 text-xs uppercase tracking-wider transition-colors ${
          value === kind
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {text}
      </button>
    ))}
  </div>
);

/** The lines of a quote: what is sold, how many, at what price, and whether it is a part or labour. */
export const QuoteLines = ({
  lines,
  catalog,
  onChange,
}: {
  lines: DealPackageLine[];
  catalog: Map<string, Package>;
  onChange: (lines: DealPackageLine[]) => void;
}) => {
  const change = (index: number, patch: Partial<DealPackageLine>) =>
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  return (
    <div className="flex flex-col gap-3">
      {lines.length ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {lines.map((line, i) => {
            const pkg =
              line.package_id != null
                ? catalog.get(String(line.package_id))
                : undefined;
            return (
              <li
                key={`${line.package_id ?? "custom"}-${i}`}
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {pkg ? (
                    <ProductThumb pkg={pkg} size={44} />
                  ) : (
                    <span className="grid size-11 shrink-0 place-items-center rounded-sm bg-muted text-muted-foreground">
                      <Wrench className="size-4" aria-hidden />
                    </span>
                  )}
                  <Input
                    value={line.title}
                    onChange={(e) => change(i, { title: e.target.value })}
                    aria-label="Line description"
                    className="h-10 min-w-0 flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <KindSwitch
                    value={lineKind(line)}
                    label={line.title}
                    onChange={(kind) => change(i, { kind })}
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      change(i, {
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    aria-label={`Quantity of ${line.title}`}
                    className="h-10 w-16 lab-num"
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={line.price}
                    onChange={(e) =>
                      change(i, {
                        price: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    aria-label={`Price of ${line.title}`}
                    className="h-10 w-28 lab-num"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 shrink-0"
                    aria-label={`Remove ${line.title}`}
                    onClick={() => onChange(lines.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Add a suggested part, pick from the catalog, or add labour.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <PackagePicker
          label="Add from catalog"
          onPick={(pkg) => onChange([...lines, lineFromCatalog(pkg)])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...lines,
              {
                package_id: null,
                title: "Install labour",
                price: 0,
                quantity: 1,
                kind: "labour",
              },
            ])
          }
        >
          <Wrench className="size-4" />
          Add labour
        </Button>
      </div>
    </div>
  );
};
