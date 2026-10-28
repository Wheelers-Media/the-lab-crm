import { useMemo, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { money } from "../operations/format";
import type { Order, Package } from "../types";
import type { NumbersRanges } from "./periods";
import {
  salesByBrand,
  salesByProduct,
  salesSummary,
  withPrevious,
} from "./salesModel";
import type { Column } from "./widgets";
import { Delta, SectionCard, StatTable } from "./widgets";

type Sort = "netSales" | "units";

export const ProductsSection = ({
  orders,
  catalog,
  ranges,
}: {
  orders: Order[];
  catalog: Package[];
  ranges: NumbersRanges;
}) => {
  const [sort, setSort] = useState<Sort>("netSales");
  const data = useMemo(() => {
    const products = salesByProduct(orders, ranges.current, catalog);
    const before = salesByProduct(orders, ranges.previous, catalog);
    return {
      total: salesSummary(orders, ranges.current).netSales,
      products: withPrevious(products, before),
      brands: withPrevious(salesByBrand(products), salesByBrand(before)),
    };
  }, [orders, catalog, ranges]);

  const sorted = useMemo(
    () =>
      [...data.products].sort(
        (a, b) => b[sort] - a[sort] || b.netSales - a.netSales,
      ),
    [data.products, sort],
  );
  const share = (n: number) =>
    data.total ? Math.round((n / data.total) * 100) : 0;

  const productColumns: Array<Column<(typeof sorted)[number]>> = [
    { header: "Product", value: (r) => r.name },
    { header: "Brand", value: (r) => r.brand },
    { header: "Units", value: (r) => r.units, numeric: true },
    { header: "Orders", value: (r) => r.orders, numeric: true },
    {
      header: "Net sales",
      value: (r) => Math.round(r.netSales),
      display: (r) => money(r.netSales),
      numeric: true,
    },
    {
      header: "Share",
      value: (r) => share(r.netSales),
      display: (r) => `${share(r.netSales)}%`,
      numeric: true,
    },
    {
      header: "Change",
      value: (r) => r.change,
      display: (r) => <Delta value={r.change} />,
      numeric: true,
    },
  ];
  const brandColumns: Array<Column<(typeof data.brands)[number]>> = [
    { header: "Brand", value: (r) => r.name },
    { header: "Units", value: (r) => r.units, numeric: true },
    {
      header: "Net sales",
      value: (r) => Math.round(r.netSales),
      display: (r) => money(r.netSales),
      numeric: true,
    },
    {
      header: "Share",
      value: (r) => share(r.netSales),
      display: (r) => `${share(r.netSales)}%`,
      numeric: true,
    },
    {
      header: "Change",
      value: (r) => r.change,
      display: (r) => <Delta value={r.change} />,
      numeric: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
      <div className="xl:col-span-3 min-w-0">
        <SectionCard
          title="Top products"
          hint="Options are kept apart (each size or colour is its own line)."
          actions={
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={sort}
              onValueChange={(v) => v && setSort(v as Sort)}
              aria-label="Sort products by"
            >
              <ToggleGroupItem value="netSales" className="px-3">
                By sales
              </ToggleGroupItem>
              <ToggleGroupItem value="units" className="px-3">
                By units
              </ToggleGroupItem>
            </ToggleGroup>
          }
        >
          <StatTable
            rows={sorted}
            rowKey={(r) => r.name}
            columns={productColumns}
            filename="top-products.csv"
            limit={15}
          />
        </SectionCard>
      </div>
      <div className="xl:col-span-2 min-w-0">
        <SectionCard
          title="By brand"
          hint="From the catalog. Products not found there are grouped together."
        >
          <StatTable
            rows={data.brands}
            rowKey={(r) => r.name}
            columns={brandColumns}
            filename="net-sales-by-brand.csv"
          />
        </SectionCard>
      </div>
    </div>
  );
};
