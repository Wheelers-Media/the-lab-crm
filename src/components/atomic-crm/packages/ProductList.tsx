import { ImageOff } from "lucide-react";
import { Link } from "react-router";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { SearchInput } from "@/components/admin/search-input";
import { SelectInput } from "@/components/admin/select-input";
import { Card } from "@/components/ui/card";

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

export const LOW_STOCK = 2;

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

/** "3 in stock", "Out of stock", or nothing when Shopify does not track it. */
export const stockLabel = (inventory: number | null): string | null =>
  inventory == null
    ? null
    : inventory <= 0
      ? "Out of stock"
      : `${inventory} in stock`;

export const StockChip = ({ inventory }: { inventory: number | null }) => {
  const label = stockLabel(inventory);
  if (!label) return null;
  const tone =
    inventory! <= 0
      ? "lab-chip-danger"
      : inventory! <= LOW_STOCK
        ? "lab-chip-warn"
        : "lab-chip-bay";
  return <span className={`lab-chip ${tone}`}>{label}</span>;
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

const useCategoryChoices = () => {
  const { dealCategories } = useConfigurationContext();
  return dealCategories.map((c) => ({ id: c.value, name: c.label }));
};

const ProductListActions = () => (
  <TopToolbar>
    <QuickFilter label="Packages" value={{ kind: "package" }} />
    <QuickFilter label="Parts and products" value={{ kind: "product" }} />
    <QuickFilter label="Low stock" value={{ "inventory@lte": LOW_STOCK }} />
  </TopToolbar>
);

/** The Shopify catalog: shop packages and Parts Store products. Read-only. */
export const ProductList = () => {
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
      perPage={50}
    >
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
    </List>
  );
};

const ProductCard = ({ pkg }: { pkg: Package }) => (
  <Card className="p-0">
    <Link
      to={`/packages/${pkg.id}/show`}
      className="flex items-center gap-3 p-3"
    >
      <ProductThumb pkg={pkg} size={48} />
      <div className="flex-1 min-w-0">
        <p className="font-medium line-clamp-2">{pkg.title}</p>
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <KindChip pkg={pkg} />
          <StockChip inventory={pkg.inventory} />
        </div>
      </div>
      <span className="lab-num text-sm shrink-0">{packagePriceLabel(pkg)}</span>
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
    renderItem={(pkg) => <ProductCard pkg={pkg} />}
  />
);
