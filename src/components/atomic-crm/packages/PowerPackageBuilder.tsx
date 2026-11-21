import { Check, Plus, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

import type { DealPackageLine, Package } from "../types";
import {
  chooseOption,
  includedSteps,
  missingRequired,
  picksByStep,
  removeOption,
  resolvePowerSteps,
  type PowerPackage,
  type ResolvedOption,
  type ResolvedStep,
} from "./powerPackageModel";
import { packagePriceLabel } from "./packageModel";
import { ProductThumb, StockChip } from "./ProductParts";
import { quoteTotals } from "./quoteModel";
import { VariantPicker } from "./VariantPicker";

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

const OptionCard = ({
  step,
  entry,
  selected,
  onChoose,
  onRemove,
}: {
  step: ResolvedStep["step"];
  entry: ResolvedOption;
  selected?: DealPackageLine;
  onChoose: (variantId: string) => void;
  onRemove: () => void;
}) => {
  const { option, product } = entry;
  const [picked, setPicked] = useState(product.variants[0]?.id ?? "");
  const variantId = selected?.variant_id ?? picked;
  const variant = product.variants.find((v) => v.id === variantId);
  const out = product.inventory != null && product.inventory <= 0;
  const on = Boolean(selected);

  return (
    <li
      className={`flex flex-col gap-3 rounded-lg border p-3 ${
        on ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex gap-3">
        <ProductThumb pkg={product} size={64} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {option.brand ? (
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {option.brand}
            </p>
          ) : null}
          <p className="text-sm font-medium leading-snug">{option.name}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {option.runner ? (
              <span className="lab-chip lab-chip-eric">
                Runs on {option.runner}
              </span>
            ) : null}
            {option.preselect && on ? (
              <span className="lab-chip lab-chip-bay">
                Added for your truck
              </span>
            ) : null}
            <StockChip inventory={product.inventory} />
          </div>
          {option.note ? (
            <p className="text-xs text-muted-foreground">{option.note}</p>
          ) : null}
        </div>
      </div>
      <VariantPicker
        pkg={product}
        value={variantId}
        onChange={(id) => {
          setPicked(id);
          if (on) onChoose(id);
        }}
      />
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="text-sm lab-num">
          {product.variants.length > 1 && variant
            ? `$${variant.price}`
            : packagePriceLabel(product)}
        </span>
        {on ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRemove}
            aria-label={`Remove ${option.name}`}
          >
            <Check className="size-4" />
            {step.mode === "one" ? "Chosen" : "Added"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={out}
            onClick={() => onChoose(variantId)}
            aria-label={`${step.mode === "one" ? "Choose" : "Add"} ${option.name}`}
          >
            <Plus className="size-4" />
            {step.mode === "one" ? "Choose" : "Add"}
          </Button>
        )}
      </div>
    </li>
  );
};

/**
 * The website's power package for this truck, step by step, with the same
 * options in the same order: tuning, device, exhaust, tips, EGR and so on.
 * Choosing an option puts it on the quote; choosing again swaps it, and the
 * quote below stays the one place the total comes from.
 */
export const PowerPackageBuilder = ({
  pkg,
  catalog,
  lines,
  onChange,
  vin,
}: {
  pkg: PowerPackage;
  catalog: Package[];
  lines: DealPackageLine[];
  onChange: (lines: DealPackageLine[]) => void;
  vin?: string | null;
}) => {
  const { steps, missing } = useMemo(
    () => resolvePowerSteps(pkg, catalog),
    [pkg, catalog],
  );
  const picks = picksByStep(lines, pkg.id);
  const covered = includedSteps(lines, steps, pkg.id);
  const needed = missingRequired(lines, steps, pkg.id);
  const buildLines = lines.filter((l) => l.build === pkg.id);
  const total = quoteTotals(buildLines).total;
  const tuneChosen = buildLines.some((l) => l.step === "tune");

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border p-4"
      aria-labelledby="power-package"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Power package
          </p>
          <h2 id="power-package" className="text-lg font-semibold">
            {pkg.title}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">This build</p>
          <p className="text-lg font-semibold lab-num">{money(total)}</p>
        </div>
      </header>

      {needed.length ? (
        <p className="flex items-center gap-2 text-sm" role="status">
          <span className="lab-chip lab-chip-warn">Still needed</span>
          {needed.join(", ")}
        </p>
      ) : buildLines.length ? (
        <p className="flex items-center gap-2 text-sm" role="status">
          <span className="lab-chip lab-chip-bay">Complete</span>
          Every required step is chosen.
        </p>
      ) : null}

      {tuneChosen && !vin ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-[var(--lab-amber)]"
            aria-hidden
          />
          The tune is written for one truck. Add the VIN to the customer's
          truck, or fill it in on the tune line below.
        </p>
      ) : null}

      <ol className="flex flex-col gap-6">
        {steps.map(({ step, options }, index) => {
          const chosen = picks.get(step.id) ?? [];
          const isCovered = covered.has(step.id);
          return (
            <li key={step.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-muted text-xs font-semibold lab-num">
                  {index + 1}
                </span>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <span
                  className={`lab-chip ${step.required ? "lab-chip-warn" : "lab-chip-muted"}`}
                >
                  {step.required ? "Required" : "Optional"}
                </span>
                {step.mode === "many" ? (
                  <span className="text-xs text-muted-foreground">
                    Pick any
                  </span>
                ) : null}
              </div>
              {step.text ? (
                <p className="text-xs leading-snug text-muted-foreground">
                  {step.text}
                </p>
              ) : null}
              {isCovered ? (
                <p className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  <Check className="size-4 text-[var(--lab-pos)]" aria-hidden />
                  Included in the exhaust package you chose.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
                  {options.map((entry) => (
                    <OptionCard
                      key={entry.product.id}
                      step={step}
                      entry={entry}
                      selected={chosen.find(
                        (l) =>
                          String(l.package_id) === String(entry.product.id),
                      )}
                      onChoose={(variantId) =>
                        onChange(
                          chooseOption(
                            lines,
                            pkg.id,
                            steps,
                            step.id,
                            entry.product,
                            variantId,
                            vin,
                          ),
                        )
                      }
                      onRemove={() =>
                        onChange(
                          removeOption(
                            lines,
                            pkg.id,
                            step.id,
                            entry.product.id,
                          ),
                        )
                      }
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      {missing.length ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {missing.length} website option{missing.length === 1 ? "" : "s"} not
            in the catalog
          </summary>
          <p className="mt-1">
            Run Sync catalog on Packages and products, or check the product is
            active in Shopify. Missing: {missing.join(", ")}.
          </p>
        </details>
      ) : null}
    </section>
  );
};
