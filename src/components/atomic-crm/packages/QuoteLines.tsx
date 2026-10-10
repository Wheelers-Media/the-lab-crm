import { Trash2, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { DealPackageLine, Package } from "../types";
import { ProductThumb } from "./ProductList";
import { LABOUR_RATE, labourLine, lineKind, type LineKind } from "./quoteModel";

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
        className={`h-8 min-w-14 rounded-sm px-2 text-xs uppercase tracking-wider transition-colors ${
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

/**
 * A number box that lets you type freely ("1.", "") and keeps the last good
 * number, without the leading zero a plain number input leaves ("0125").
 */
const NumberField = ({
  value,
  onCommit,
  min,
  allowDecimals,
  label,
  prefix,
  suffix,
  className,
}: {
  value: number;
  onCommit: (value: number) => void;
  min: number;
  allowDecimals?: boolean;
  label: string;
  prefix?: string;
  suffix?: string;
  className?: string;
}) => {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((current) => (Number(current) === value ? current : String(value)));
  }, [value]);
  return (
    <label
      className={`flex h-10 items-center gap-1 rounded-md border border-input px-2 focus-within:ring-2 focus-within:ring-ring dark:bg-input/30 ${className ?? ""}`}
    >
      {prefix ? (
        <span className="text-sm text-muted-foreground">{prefix}</span>
      ) : null}
      <input
        type="text"
        inputMode={allowDecimals ? "decimal" : "numeric"}
        value={text}
        aria-label={label}
        onChange={(e) => {
          const cleaned = e.target.value
            .replace(allowDecimals ? /[^\d.]/g : /\D/g, "")
            .replace(/^0+(?=\d)/, "");
          setText(cleaned);
          const n = Number(cleaned);
          if (cleaned !== "" && !Number.isNaN(n)) onCommit(Math.max(min, n));
        }}
        onBlur={() => setText(String(value))}
        className="w-full min-w-0 bg-transparent text-base outline-none lab-num"
      />
      {suffix ? (
        <span className="text-xs text-muted-foreground">{suffix}</span>
      ) : null}
    </label>
  );
};

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
                <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-2 sm:flex sm:w-auto">
                  <KindSwitch
                    value={lineKind(line)}
                    label={line.title}
                    onChange={(kind) => change(i, { kind })}
                  />
                  <NumberField
                    value={line.quantity}
                    allowDecimals={lineKind(line) === "labour"}
                    min={lineKind(line) === "labour" ? 0.25 : 1}
                    suffix={lineKind(line) === "labour" ? "h" : "qty"}
                    label={
                      lineKind(line) === "labour"
                        ? `Hours of ${line.title}`
                        : `Quantity of ${line.title}`
                    }
                    onCommit={(quantity) => change(i, { quantity })}
                    className="sm:w-20"
                  />
                  <NumberField
                    value={line.price}
                    allowDecimals
                    min={0}
                    prefix="$"
                    suffix={lineKind(line) === "labour" ? "/h" : undefined}
                    label={
                      lineKind(line) === "labour"
                        ? `Rate for ${line.title}`
                        : `Price of ${line.title}`
                    }
                    onCommit={(price) => change(i, { price })}
                    className="sm:w-32"
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
          Add a suggested part, search for one, or add labour.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...lines, labourLine(1)])}
        >
          <Wrench className="size-4" />
          Add labour (${LABOUR_RATE}/h)
        </Button>
      </div>
    </div>
  );
};
