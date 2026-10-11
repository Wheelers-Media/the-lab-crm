import { LayoutGrid, Table2 } from "lucide-react";
import { useStore } from "ra-core";
import { Link } from "react-router";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { SearchInput } from "@/components/admin/search-input";
import { SelectInput } from "@/components/admin/select-input";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { TopToolbar } from "../layout/TopToolbar";
import {
  MobileFilterChip,
  MobileListPage,
  MobileSearch,
} from "../layout/MobileListPage";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { QuickFilter } from "../shop/QuickFilter";
import type { Package } from "../types";
import { packagePriceLabel } from "./packageModel";
import { LOW_STOCK } from "./productModel";
import { ProductGrid } from "./ProductCards";
import { KindChip, ProductThumb, StockChip } from "./ProductParts";
import { SyncCatalogButton } from "./SyncCatalogButton";

const useCategoryChoices = () => {
  const { dealCategories } = useConfigurationContext();
  return dealCategories.map((c) => ({ id: c.value, name: c.label }));
};

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
      <QuickFilter label="Packages" value={{ kind: "package" }} />
      <QuickFilter label="Parts and products" value={{ kind: "product" }} />
      <QuickFilter label="Low stock" value={{ "inventory@lte": LOW_STOCK }} />
    </TopToolbar>
  );
};

/** The Shopify catalog: shop packages and Parts Store products. Read-only. */
export const ProductList = () => {
  const [view] = useStore<View>("packages.view", "cards");
  const categories = useCategoryChoices();
  const { dealCategories } = useConfigurationContext();
  const categoryLabel = (value: string | null) =>
    dealCategories.find((c) => c.value === value)?.label ?? "Other";
  return (
    <List
      title="Packages and products"
      actions={<ProductListActions />}
      filter={{ "status@neq": "deleted" }}
      filters={[
        <SearchInput source="q" alwaysOn key="q" />,
        <SelectInput
          key="category"
          source="category"
          label={false}
          emptyText="All services"
          choices={categories}
          alwaysOn
        />,
      ]}
      sort={{ field: "title", order: "ASC" }}
      perPage={view === "cards" ? 48 : 50}
    >
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
            label="Service"
            render={(p) => (
              <div className="flex flex-wrap gap-1">
                <KindChip pkg={p} />
                <span className="lab-chip lab-chip-muted">
                  {categoryLabel(p.category)}
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
    </List>
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
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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

export const MobileProductList = () => (
  <MobileListPage<Package>
    resource="packages"
    title="Packages"
    filter={{ "status@neq": "deleted" }}
    sort={{ field: "title", order: "ASC" }}
    empty="Nothing in the catalog yet."
    toolbar={
      <div className="flex flex-col gap-2">
        <MobileSearch placeholder="Search packages and parts" />
        <div className="flex flex-wrap gap-2">
          <MobileFilterChip label="Packages" value={{ kind: "package" }} />
          <MobileFilterChip label="Parts" value={{ kind: "product" }} />
          <MobileFilterChip
            label="Low stock"
            value={{ "inventory@lte": LOW_STOCK }}
          />
        </div>
      </div>
    }
    renderItem={(pkg) => <MobileProductCard pkg={pkg} />}
  />
);
