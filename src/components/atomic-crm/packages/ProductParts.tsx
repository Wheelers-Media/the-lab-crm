import { ImageOff } from "lucide-react";

import type { Package } from "../types";
import { stockInfo } from "./productModel";

export const ProductThumb = ({
  pkg,
  size = 40,
}: {
  pkg: Pick<Package, "image_url" | "title">;
  size?: number;
}) =>
  pkg.image_url ? (
    <img
      src={pkg.image_url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="rounded-sm object-cover bg-muted shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="grid place-items-center rounded-sm bg-muted text-muted-foreground shrink-0"
      style={{ width: size, height: size }}
    >
      <ImageOff className="size-4" aria-hidden />
    </span>
  );

const STOCK_TONE = {
  ok: "lab-chip-bay",
  low: "lab-chip-warn",
  out: "lab-chip-danger",
  "made-to-order": "lab-chip-muted",
} as const;

/** "3 in stock", "Out of stock", "Made to order", or nothing when Shopify does not track it. */
export const stockLabel = (inventory: number | null): string | null =>
  stockInfo(inventory)?.label ?? null;

export const StockChip = ({ inventory }: { inventory: number | null }) => {
  const stock = stockInfo(inventory);
  if (!stock) return null;
  return (
    <span className={`lab-chip ${STOCK_TONE[stock.tone]}`}>{stock.label}</span>
  );
};

export const KindChip = ({ pkg }: { pkg: Pick<Package, "kind" | "bay"> }) =>
  pkg.kind === "package" ? (
    <span className="lab-chip lab-chip-boutique">Package</span>
  ) : (
    <span
      className={`lab-chip ${pkg.bay === "parts" ? "lab-chip-parts" : "lab-chip-muted"}`}
    >
      Product
    </span>
  );
