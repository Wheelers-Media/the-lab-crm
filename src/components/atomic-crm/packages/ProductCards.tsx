import { ImageOff } from "lucide-react";
import { useListContext } from "ra-core";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import type { Package } from "../types";
import { packagePriceLabel } from "./packageModel";
import { marginOf } from "./productModel";
import { StockChip } from "./ProductParts";

/** A product as a card: picture, brand, name, price, stock and margin when known. */
export const ProductCard = ({ pkg }: { pkg: Package }) => {
  // One margin for a product with one cost; a range of options has no single number
  const first = pkg.variants?.[0];
  const margin = pkg.variants?.length === 1 && first ? marginOf(first) : null;
  return (
    <Link
      to={`/packages/${pkg.id}/show`}
      className="group block h-full rounded-xl"
    >
      <Card className="p-0 gap-0 h-full overflow-hidden transition-colors group-hover:bg-muted/40">
        <div
          className={`relative bg-muted ${pkg.image_url ? "aspect-square" : "aspect-[16/6]"}`}
        >
          {pkg.image_url ? (
            <img
              src={pkg.image_url}
              alt=""
              loading="lazy"
              className="size-full object-contain"
            />
          ) : (
            <span className="grid size-full place-items-center text-muted-foreground">
              <ImageOff className="size-8" aria-hidden />
            </span>
          )}
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            <StockChip inventory={pkg.inventory} />
            {pkg.status !== "active" ? (
              <span className="lab-chip lab-chip-muted">{pkg.status}</span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-1 p-3">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {pkg.vendor || "THE LAB"}
          </p>
          <p className="line-clamp-2 text-sm font-medium leading-snug">
            {pkg.title}
          </p>
          <div className="flex items-baseline justify-between gap-2 pt-1">
            <span className="lab-num font-semibold">
              {packagePriceLabel(pkg)}
            </span>
            {margin ? (
              <span className="lab-num text-xs text-muted-foreground">
                {margin.percent}% margin
              </span>
            ) : null}
          </div>
          {first?.sku ? (
            <p className="truncate text-xs text-muted-foreground">
              {first.sku}
              {pkg.variants.length > 1
                ? ` +${pkg.variants.length - 1} options`
                : ""}
            </p>
          ) : null}
        </div>
      </Card>
    </Link>
  );
};

const GRID =
  "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-3";

/** The catalog as a wall of product cards. */
export const ProductGrid = () => {
  const { data, isPending } = useListContext<Package>();
  if (isPending) {
    return (
      <div className={GRID}>
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full" />
        ))}
      </div>
    );
  }
  if (!data?.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nothing matches.
      </p>
    );
  }
  return (
    <div className={GRID}>
      {data.map((pkg) => (
        <ProductCard key={pkg.id} pkg={pkg} />
      ))}
    </div>
  );
};
