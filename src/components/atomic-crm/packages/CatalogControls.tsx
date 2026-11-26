import { Search, X } from "lucide-react";
import { Fragment } from "react";

import { POWER_PACKAGES } from "./powerPackageModel";
import { SECTIONS } from "./catalogSections";
import type { StockFilter, useCatalogBrowser } from "./useCatalogBrowser";

type Browser = ReturnType<typeof useCatalogBrowser>;

const chip = (active: boolean) =>
  `shrink-0 rounded-md border px-3 py-1.5 text-xs uppercase tracking-wider whitespace-nowrap ${
    active
      ? "border-primary bg-primary/15 text-foreground"
      : "border-border text-muted-foreground hover:text-foreground"
  }`;

const STOCK_CHOICES: Array<[StockFilter, string]> = [
  ["all", "Any stock"],
  ["in", "In stock"],
  ["low", "Low stock"],
  ["out", "Out of stock"],
];

/**
 * Browse by store section (the same headings as the website), with a count on
 * each, plus search, brand and stock. Sections with nothing in them are left
 * out so there is never a dead tap. Power packages sit first.
 */
export const CatalogControls = ({ browser }: { browser: Browser }) => {
  const { counts, section, setSection, q, setQ, vendors, vendor, stock } =
    browser;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const groups = ["Performance Shop", "Boutique", "Everything else"] as const;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, brand, tag or SKU"
            aria-label="Search the catalog"
            className="h-10 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-base dark:bg-input/30"
          />
        </div>
        <select
          value={vendor}
          onChange={(e) => browser.setVendor(e.target.value)}
          aria-label="Brand"
          className="h-10 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        >
          <option value="">All brands</option>
          {vendors.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={stock}
          onChange={(e) => browser.setStock(e.target.value as StockFilter)}
          aria-label="Stock"
          className="h-10 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        >
          {STOCK_CHOICES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {browser.hasFilters ? (
          <button
            type="button"
            onClick={browser.clear}
            className="inline-flex h-10 items-center gap-1 rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
            Clear
          </button>
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Store sections"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
      >
        <button
          type="button"
          aria-pressed={section === null}
          onClick={() => setSection(null)}
          className={chip(section === null)}
        >
          Everything <span className="lab-num">{total}</span>
        </button>
        <button
          type="button"
          aria-pressed={section === "power"}
          onClick={() => setSection("power")}
          className={chip(section === "power")}
        >
          Power packages{" "}
          <span className="lab-num">{POWER_PACKAGES.length}</span>
        </button>
        {groups.map((group) => (
          <Fragment key={group}>
            {SECTIONS.filter((s) => s.group === group && counts[s.id] > 0).map(
              (s) => (
                <button
                  key={s.id}
                  type="button"
                  title={s.hint}
                  aria-pressed={section === s.id}
                  onClick={() => setSection(s.id)}
                  className={chip(section === s.id)}
                >
                  {s.label} <span className="lab-num">{counts[s.id]}</span>
                </button>
              ),
            )}
          </Fragment>
        ))}
      </div>
      {section && section !== "power" ? (
        <p className="text-xs text-muted-foreground">
          {SECTIONS.find((s) => s.id === section)?.hint}
        </p>
      ) : null}
    </div>
  );
};
