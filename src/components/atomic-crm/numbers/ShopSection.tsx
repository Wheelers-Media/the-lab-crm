import { useMemo } from "react";

import { money } from "../operations/format";
import { KpiTile } from "../operations/OperationsWidgets";
import type { Appointment, Order, Package } from "../types";
import { shopCapacity, upcomingLoad } from "./capacityModel";
import { inventoryHealth, type StockLine, slowWindow } from "./inventoryModel";
import type { NumbersRanges } from "./periods";
import type { Column } from "./widgets";
import { SectionCard, StatTable } from "./widgets";

const pct = (n: number | null) => (n == null ? "–" : `${n}%`);

const stockColumns: Array<Column<StockLine>> = [
  { header: "Product", value: (r) => r.title },
  { header: "Brand", value: (r) => r.vendor },
  { header: "In stock", value: (r) => r.units, numeric: true },
  { header: "Sold (90 days)", value: (r) => r.soldRecently, numeric: true },
  {
    header: "Shelf value",
    value: (r) => Math.round(r.retailValue),
    display: (r) => money(r.retailValue),
    numeric: true,
  },
];

export const ShopSection = ({
  catalog,
  orders,
  appointments,
  ranges,
  now,
}: {
  catalog: Package[];
  orders: Order[];
  appointments: Appointment[];
  ranges: NumbersRanges;
  now: Date;
}) => {
  const data = useMemo(
    () => ({
      stock: inventoryHealth(catalog, orders, slowWindow(now)),
      capacity: shopCapacity(appointments, ranges.current),
      upcoming: upcomingLoad(appointments, now),
    }),
    [catalog, orders, appointments, ranges, now],
  );
  const { stock: s, capacity: c, upcoming: u } = data;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiTile
          label="Stock on the shelf"
          value={money(s.stockValue)}
          detail={`at retail · ${s.inStock} of ${s.tracked} tracked products in stock`}
        />
        <KpiTile
          label="Out of stock"
          value={String(s.outOfStock)}
          detail={`${s.outOfStockSellers.length} sold in the last 90 days`}
        />
        <KpiTile
          label="Sold without stock"
          value={String(s.madeToOrder)}
          detail="negative stock: drop-shipped or made to order"
        />
        <KpiTile
          label="Bay booked"
          value={pct(c.utilization)}
          detail={`${c.bayBooked} of ${c.bayCapacity} drop-off slots`}
        />
        <KpiTile
          label="Next 2 weeks"
          value={pct(u.utilization)}
          detail={`${u.open} open bay slots over ${u.businessDays} days`}
        />
        <KpiTile
          label="No-shows"
          value={pct(c.noShowRate)}
          detail={`${c.noShows} · deposits paid on ${pct(c.depositRate)} of bookings`}
        />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard
          title="Best sellers to reorder"
          hint="Sold in the last 90 days and out of stock or nearly gone."
        >
          <StatTable
            rows={[...s.outOfStockSellers, ...s.lowStockSellers]}
            rowKey={(r) => String(r.id)}
            columns={stockColumns}
            filename="reorder.csv"
            empty="Nothing that sells is running out."
          />
        </SectionCard>
        <SectionCard
          title="Stock that is not selling"
          hint={`On the shelf with no sales in 90 days: ${money(s.slowValue)} at retail.`}
        >
          <StatTable
            rows={s.slowMovers}
            rowKey={(r) => String(r.id)}
            columns={stockColumns}
            filename="slow-movers.csv"
            empty="Everything on the shelf has sold lately."
          />
        </SectionCard>
      </div>
    </>
  );
};
