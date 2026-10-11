// Matches an order line to the catalog product it sold, so sales can be
// grouped by brand and compared with stock. Order lines carry the product
// name plus the option ("Prerunner Front Bumper - Black") and sometimes a SKU.
import type { OrderLineItem, Package } from "../types";

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const catalogMatcher = (catalog: Package[]) => {
  const bySku = new Map<string, Package>();
  const byTitle = new Map<string, Package>();
  for (const pkg of catalog) {
    for (const variant of pkg.variants ?? []) {
      if (variant.sku) bySku.set(variant.sku.toLowerCase(), pkg);
    }
    for (const title of [pkg.shopify_title, pkg.title]) {
      const key = normalize(title ?? "");
      if (key && !byTitle.has(key)) byTitle.set(key, pkg);
    }
  }
  // Longest titles first, so "X Exhaust With Muffler" wins over "X Exhaust"
  const prefixes = [...byTitle.entries()].sort(
    (a, b) => b[0].length - a[0].length,
  );

  return (line: Pick<OrderLineItem, "name" | "sku">): Package | undefined => {
    if (line.sku && bySku.has(line.sku.toLowerCase()))
      return bySku.get(line.sku.toLowerCase());
    const name = normalize(line.name ?? "");
    if (!name) return undefined;
    const exact = byTitle.get(name);
    if (exact) return exact;
    return prefixes.find(([title]) => name.startsWith(`${title} `))?.[1];
  };
};
