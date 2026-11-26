import { useGetList } from "ra-core";
import { useMemo } from "react";
import { useSearchParams } from "react-router";

import type { Package } from "../types";
import {
  inSection,
  matchesCatalogQuery,
  SECTIONS,
  sectionCounts,
  type SectionId,
} from "./catalogSections";
import { LOW_STOCK } from "./productModel";

export type StockFilter = "all" | "in" | "low" | "out";

/** "power" is the website's power packages, shown as builds rather than products. */
export type SectionChoice = SectionId | "power" | null;

const isSection = (value: string | null): value is SectionId =>
  SECTIONS.some((s) => s.id === value);

const stockMatches = (pkg: Package, stock: StockFilter): boolean => {
  if (stock === "all") return true;
  const n = pkg.inventory;
  if (stock === "out") return n === 0;
  if (stock === "low") return n != null && n > 0 && n <= LOW_STOCK;
  return n == null || n > 0;
};

/**
 * The whole catalog, filtered the way the shop browses it: by store section,
 * brand, stock and a search over names, brands, tags and SKUs. What is picked
 * lives in the address, so a view can be shared and Back returns to it. The
 * query is the quote builder's, so both share one cached catalog.
 */
export const useCatalogBrowser = () => {
  const { data: catalog = [], isPending } = useGetList<Package>("packages", {
    pagination: { page: 1, perPage: 2000 },
    sort: { field: "title", order: "ASC" },
    filter: { "status@neq": "deleted" },
  });
  const [params, setParams] = useSearchParams();
  const sectionParam = params.get("section");
  const section: SectionChoice =
    sectionParam === "power"
      ? "power"
      : isSection(sectionParam)
        ? sectionParam
        : null;
  const q = params.get("q") ?? "";
  const vendor = params.get("brand") ?? "";
  const stockParam = params.get("stock");
  const stock: StockFilter =
    stockParam === "in" || stockParam === "low" || stockParam === "out"
      ? stockParam
      : "all";

  const set = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const counts = useMemo(() => sectionCounts(catalog), [catalog]);
  const vendors = useMemo(
    () =>
      [...new Set(catalog.map((p) => p.vendor).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ) as string[],
    [catalog],
  );
  const items = useMemo(
    () =>
      inSection(catalog, section === "power" ? null : section).filter(
        (p) =>
          (!vendor || p.vendor === vendor) &&
          stockMatches(p, stock) &&
          matchesCatalogQuery(p, q),
      ),
    [catalog, section, vendor, stock, q],
  );

  return {
    catalog,
    items,
    counts,
    vendors,
    isPending,
    section,
    q,
    vendor,
    stock,
    setSection: (value: SectionChoice) => set("section", value),
    setQ: (value: string) => set("q", value || null),
    setVendor: (value: string) => set("brand", value || null),
    setStock: (value: StockFilter) =>
      set("stock", value === "all" ? null : value),
    clear: () => setParams({}, { replace: true }),
    hasFilters: Boolean(section || q || vendor || stock !== "all"),
  };
};
