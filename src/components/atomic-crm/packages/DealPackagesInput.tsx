import { Trash2 } from "lucide-react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { DealPackageLine, Package } from "../types";
import { lineFromPackage, linesTotal } from "./packageModel";
import { PackagePicker } from "./PackagePicker";

const money = (n: number) =>
  n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  });

/**
 * The packages on a job. Each line starts at the Shopify price and can be
 * changed for this customer. The job amount follows the package total until
 * someone types a different amount.
 */
export const DealPackagesInput = () => {
  const { field } = useController({ name: "packages", defaultValue: [] });
  const { getValues, setValue } = useFormContext();
  const lines: DealPackageLine[] = Array.isArray(field.value)
    ? field.value
    : [];
  const amount = useWatch({ name: "amount" }) as number | undefined;
  const total = linesTotal(lines);

  const update = (next: DealPackageLine[]) => {
    const before = linesTotal(lines);
    field.onChange(next);
    // Keep the amount in step unless it was set by hand
    const current = Number(getValues("amount")) || 0;
    if (current === 0 || current === Math.round(before)) {
      setValue("amount", Math.round(linesTotal(next)), { shouldDirty: true });
    }
  };

  const add = (pkg: Package) => {
    update([...lines, lineFromPackage(pkg)]);
    if (!getValues("category") && pkg.category)
      setValue("category", pkg.category, { shouldDirty: true });
    if (!getValues("name")) setValue("name", pkg.title, { shouldDirty: true });
  };

  const change = (index: number, patch: Partial<DealPackageLine>) =>
    update(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-base font-medium">Packages</h3>
      {lines.length ? (
        <div className="flex flex-col gap-2">
          {lines.map((line, i) => (
            <div
              key={`${line.package_id ?? "custom"}-${i}`}
              className="grid grid-cols-[1fr_4rem_6.5rem_auto] items-center gap-2"
            >
              <Input
                value={line.title}
                onChange={(e) => change(i, { title: e.target.value })}
                aria-label="Package"
                className="h-9"
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
                aria-label="Quantity"
                className="h-9 lab-num"
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={line.price}
                onChange={(e) =>
                  change(i, { price: Math.max(0, Number(e.target.value) || 0) })
                }
                aria-label="Price"
                className="h-9 lab-num"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label={`Remove ${line.title}`}
                onClick={() => update(lines.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Pick packages from the Shopify catalog. The job amount adds up as you
          go.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <PackagePicker onPick={add} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            update([
              ...lines,
              { package_id: null, title: "Custom work", price: 0, quantity: 1 },
            ])
          }
        >
          Custom line
        </Button>
        {lines.length ? (
          <span className="ml-auto text-sm lab-num">
            Total {money(total)}
            {amount != null && Math.round(total) !== Number(amount) ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-2"
                onClick={() =>
                  setValue("amount", Math.round(total), { shouldDirty: true })
                }
              >
                Use as amount
              </Button>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
};
