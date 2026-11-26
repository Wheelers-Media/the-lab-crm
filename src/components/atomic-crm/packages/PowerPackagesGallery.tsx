import { Link } from "react-router";
import { Card } from "@/components/ui/card";

import type { Package } from "../types";
import { packagePriceLabel } from "./packageModel";
import { POWER_PACKAGES, resolvePowerSteps } from "./powerPackageModel";

const money = (n: number) =>
  n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

const cheapest = (product: Package): number =>
  Math.min(
    ...(product.variants.length
      ? product.variants.map((v) => v.price)
      : [product.price ?? 0]),
  );

/**
 * The website's diesel power packages: one card per truck platform and years,
 * with every step (tune, exhaust, parts) and what the shop offers in it, priced
 * from the live catalog. Open one to see each option and jump to the product.
 */
export const PowerPackagesGallery = ({ catalog }: { catalog: Package[] }) => (
  <div className="flex flex-col gap-3">
    <p className="text-sm text-muted-foreground">
      The same builds customers see on thelabfsj.ca/diesel. Start one from a
      customer's job in the quote builder; the steps below show what each truck
      can be built with.
    </p>
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {POWER_PACKAGES.map((pkg) => {
        const { steps } = resolvePowerSteps(pkg, catalog);
        const fromTotal = steps
          .filter(({ step }) => step.required)
          .reduce(
            (sum, { options }) =>
              sum + Math.min(...options.map((o) => cheapest(o.product))),
            0,
          );
        return (
          <Card key={pkg.id} className="gap-3 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold normal-case">
                {pkg.title}
              </h3>
              {fromTotal > 0 ? (
                <span className="lab-num text-sm font-semibold">
                  from {money(fromTotal)}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {pkg.make} · {pkg.engine}L · {pkg.years}
            </p>
            <ul className="flex flex-col gap-2">
              {steps.map(({ step, options }) => (
                <li key={step.id}>
                  <details>
                    <summary className="flex cursor-pointer items-center gap-2 text-sm">
                      <span className="font-medium">{step.title}</span>
                      <span className="lab-chip lab-chip-muted">
                        {step.required ? "Required" : "Optional"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {options.length} option{options.length === 1 ? "" : "s"}
                      </span>
                    </summary>
                    <ul className="mt-2 flex flex-col gap-1 pl-3">
                      {options.map(({ option, product }) => (
                        <li
                          key={option.handle}
                          className="flex items-baseline justify-between gap-3 text-sm"
                        >
                          <Link
                            to={`/packages/${product.id}/show`}
                            className="underline-offset-2 hover:underline"
                          >
                            {[option.brand, option.name]
                              .filter(Boolean)
                              .join(" ")}
                          </Link>
                          <span className="lab-num text-muted-foreground">
                            {packagePriceLabel(product)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  </div>
);
