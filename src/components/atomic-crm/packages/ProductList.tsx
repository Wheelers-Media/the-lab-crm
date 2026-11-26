import { LayoutGrid, Table2 } from "lucide-react";
import {
  ListContextProvider,
  useList,
  useListContext,
  useStore,
} from "ra-core";
import { useState } from "react";
import { Link } from "react-router";
import { DataTable } from "@/components/admin/data-table";
import { ListPagination } from "@/components/admin/list-pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { TopToolbar } from "../layout/TopToolbar";
import type { Package } from "../types";
import { CatalogControls } from "./CatalogControls";
import { sectionLabel, sectionOf } from "./catalogSections";
import { packagePriceLabel } from "./packageModel";
import { PowerPackagesGallery } from "./PowerPackagesGallery";
import { ProductGrid } from "./ProductCards";
import { KindChip, ProductThumb, StockChip } from "./ProductParts";
import { SyncCatalogButton } from "./SyncCatalogButton";
import { useCatalogBrowser } from "./useCatalogBrowser";

type View = "cards" | "table";

const ProductListActions = () => {
  const [view, setView] = useStore<View>("packages.view", "cards");
  return (
    <TopToolbar>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={view}
        onValueChange={(v) => v && setView(v as View)}
        aria-label="Show products as"
      >
        <ToggleGroupItem value="cards" className="px-3" aria-label="Cards">
          <LayoutGrid className="size-4" />
          Cards
        </ToggleGroupItem>
        <ToggleGroupItem value="table" className="px-3" aria-label="Table">
          <Table2 className="size-4" />
          Table
        </ToggleGroupItem>
      </ToggleGroup>
      <SyncCatalogButton />
    </TopToolbar>
  );
};

const CatalogError = ({ onRetry }: { onRetry: () => void }) => (
  <div role="alert" className="rounded-md border border-border p-3 text-sm">
    Couldn't load the catalog, so nothing is shown rather than a partial list.{" "}
    <button type="button" className="underline" onClick={onRetry}>
      Try again
    </button>
  </div>
);

const SORTS: Array<[string, string, "ASC" | "DESC"]> = [
  ["Name A to Z", "title", "ASC"],
  ["Price, high to low", "price", "DESC"],
  ["Price, low to high", "price", "ASC"],
  ["Most in stock", "inventory", "DESC"],
];

const ProductResults = ({ view }: { view: View }) => {
  const { setSort, sort } = useListContext<Package>();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        <select
          aria-label="Sort"
          value={`${sort.field}:${sort.order}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split(":");
            setSort({ field, order: order as "ASC" | "DESC" });
          }}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        >
          {SORTS.map(([label, field, order]) => (
            <option key={label} value={`${field}:${order}`}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {view === "cards" ? (
        <ProductGrid />
      ) : (
        <DataTable<Package> bulkActionButtons={false} rowClick="show">
          <DataTable.Col<Package>
            source="title"
            label="Name"
            render={(p) => (
              <div className="flex items-center gap-3">
                <ProductThumb pkg={p} />
                <div className="min-w-0">
                  <div className="font-medium truncate max-w-md">{p.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[p.vendor, p.product_type].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
            )}
          />
          <DataTable.Col<Package>
            source="category"
            label="Section"
            render={(p) => (
              <div className="flex flex-wrap gap-1">
                <KindChip pkg={p} />
                <span className="lab-chip lab-chip-muted">
                  {sectionLabel(sectionOf(p))}
                </span>
              </div>
            )}
          />
          <DataTable.Col<Package>
            source="price"
            label="Price"
            headerClassName="text-right"
            cellClassName="text-right lab-num"
            render={(p) => packagePriceLabel(p)}
          />
          <DataTable.Col<Package>
            source="inventory"
            label="Stock"
            render={(p) => <StockChip inventory={p.inventory} />}
          />
          <DataTable.Col<Package>
            source="status"
            label="Shopify"
            render={(p) =>
              p.status === "active" ? null : (
                <span className="lab-chip lab-chip-muted">{p.status}</span>
              )
            }
          />
        </DataTable>
      )}
      <ListPagination rowsPerPageOptions={[24, 48, 96, 200]} />
    </div>
  );
};

/**
 * The whole Shopify catalog in one place: power packages, tuning, EGR,
 * exhaust, CCV, bumpers and accessories, merch and the Boutique's services.
 * Browse by store section, brand or stock, or search; open anything for its
 * details. Read-only: Shopify owns names and prices.
 */
export const ProductList = () => {
  const [view] = useStore<View>("packages.view", "cards");
  const browser = useCatalogBrowser();
  const listContext = useList<Package>({
    data: browser.items,
    isPending: browser.isPending,
    resource: "packages",
    perPage: view === "cards" ? 48 : 50,
    sort: { field: "title", order: "ASC" },
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-2xl font-bold tracking-tight">
          Packages and products
        </h2>
        <ProductListActions />
      </div>
      <CatalogControls browser={browser} />
      {browser.error ? (
        <CatalogError onRetry={() => void browser.refetch()} />
      ) : browser.section === "power" ? (
        <PowerPackagesGallery catalog={browser.catalog} />
      ) : (
        <ListContextProvider value={listContext}>
          <p className="text-xs text-muted-foreground">
            {browser.items.length} item{browser.items.length === 1 ? "" : "s"}
          </p>
          <ProductResults view={view} />
        </ListContextProvider>
      )}
    </div>
  );
};

const MobileProductCard = ({ pkg }: { pkg: Package }) => (
  <Card className="p-0">
    <Link
      to={`/packages/${pkg.id}/show`}
      className="flex items-center gap-3 p-3"
    >
      <ProductThumb pkg={pkg} size={72} />
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {pkg.vendor || "THE LAB"}
        </p>
        <p className="font-medium leading-snug line-clamp-2">{pkg.title}</p>
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <KindChip pkg={pkg} />
          <StockChip inventory={pkg.inventory} />
        </div>
        <p className="lab-num pt-1 text-sm font-semibold">
          {packagePriceLabel(pkg)}
        </p>
      </div>
    </Link>
  </Card>
);

const PHONE_PAGE = 30;

/** The catalog on a phone: sections as a swipe row, search, and "show more". */
export const MobileProductList = () => {
  const browser = useCatalogBrowser();
  const [shown, setShown] = useState(PHONE_PAGE);
  const items = browser.items.slice(0, shown);
  return (
    <>
      <MobileHeader>
        <h1 className="text-xl">Packages and products</h1>
      </MobileHeader>
      <MobileContent>
        <div className="mb-3">
          <CatalogControls browser={browser} />
        </div>
        {browser.error ? (
          <CatalogError onRetry={() => void browser.refetch()} />
        ) : browser.section === "power" ? (
          <PowerPackagesGallery catalog={browser.catalog} />
        ) : browser.isPending ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !items.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing matches. Try a different section or clear the search.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((pkg) => (
              <MobileProductCard key={pkg.id} pkg={pkg} />
            ))}
            {browser.items.length > shown ? (
              <Button
                variant="outline"
                onClick={() => setShown(shown + PHONE_PAGE)}
              >
                Show more ({browser.items.length - shown} left)
              </Button>
            ) : null}
          </div>
        )}
      </MobileContent>
    </>
  );
};
