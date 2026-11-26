import { useMemo } from "react";
import { useNavigate } from "react-router";

import type { DrillContent, DrillRow } from "../operations/DrillSheet";
import { money } from "../operations/format";
import {
  addDays,
  inRange,
  shopDayKey,
  startOfShopDay,
} from "../operations/shopTime";
import { KpiTile } from "../operations/OperationsWidgets";
import type { Appointment, Order, Package } from "../types";
import { shopCapacity, upcomingLoad } from "./capacityModel";
import { inventoryHealth, type StockLine, slowWindow } from "./inventoryModel";
import type { NumbersRanges } from "./periods";
import { appointmentRows } from "./drillRows";
import { bucketSeries } from "./seriesModel";
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
  const navigate = useNavigate();
  const { stock: s, capacity: c, upcoming: u } = data;

  const productRows = (list: Package[]): DrillRow[] =>
    list.slice(0, 200).map((p) => ({
      key: p.id,
      title: p.title,
      subtitle: [
        p.vendor,
        p.inventory != null ? `${p.inventory} in stock` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      value: p.price != null ? money(Number(p.price)) : undefined,
      to: `/packages/${p.id}/show`,
    }));
  const live = catalog.filter((p) => p.status === "active");
  const stockDrill =
    (title: string, description: string, list: () => Package[]) =>
    (): DrillContent => ({
      title,
      description,
      empty: "No products in this group.",
      rows: productRows(list()),
    });
  const inPeriod = appointments.filter((a) =>
    inRange(a.start_at, ranges.current),
  );
  const nextTwoWeeks = appointments.filter((a) => {
    const start = new Date(a.start_at).getTime();
    return (
      start >= now.getTime() &&
      start < startOfShopDay(addDays(shopDayKey(now), 14)).getTime() &&
      a.status !== "cancelled"
    );
  });
  const sparks = useMemo(
    () => ({
      bay: bucketSeries(
        appointments.filter(
          (a) => a.resource === "detailing-bay" && a.status !== "cancelled",
        ),
        (a) => a.start_at,
        () => 1,
        ranges,
      ),
      noShows: bucketSeries(
        appointments.filter((a) => a.status === "no_show"),
        (a) => a.start_at,
        () => 1,
        ranges,
      ),
    }),
    [appointments, ranges],
  );
  const bookingDrill =
    (title: string, description: string, list: () => Appointment[]) =>
    (): DrillContent => ({
      title,
      description,
      empty: "No bookings in this group.",
      rows: appointmentRows(list()),
    });

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiTile
          label="Stock on the shelf"
          value={money(s.stockValue)}
          detail={`at retail · ${s.inStock} of ${s.tracked} tracked products in stock`}
          drill={stockDrill(
            "Stock on the shelf",
            "Active products with units on the shelf, most in stock first.",
            () =>
              live
                .filter((p) => (p.inventory ?? 0) > 0)
                .sort((a, b) => (b.inventory ?? 0) - (a.inventory ?? 0)),
          )}
        />
        <KpiTile
          label="Out of stock"
          value={String(s.outOfStock)}
          detail={`${s.outOfStockSellers.length} sold in the last 90 days`}
          drill={stockDrill(
            "Out of stock",
            "Active products tracked at zero units.",
            () => live.filter((p) => p.inventory === 0),
          )}
        />
        <KpiTile
          label="Sold without stock"
          value={String(s.madeToOrder)}
          detail="negative stock: drop-shipped or made to order"
          drill={stockDrill(
            "Sold without stock",
            "Products with negative stock: drop-shipped or made to order.",
            () => live.filter((p) => (p.inventory ?? 0) < 0),
          )}
        />
        <KpiTile
          label="Bay booked"
          value={pct(c.utilization)}
          detail={`${c.bayBooked} of ${c.bayCapacity} drop-off slots`}
          drill={bookingDrill(
            "Bay bookings",
            "Detailing-bay drop-offs in this period.",
            () =>
              inPeriod.filter(
                (a) =>
                  a.resource === "detailing-bay" && a.status !== "cancelled",
              ),
          )}
          spark={sparks.bay}
        />
        <KpiTile
          label="Next 2 weeks"
          value={pct(u.utilization)}
          detail={`${u.open} open bay slots over ${u.businessDays} days`}
          drill={bookingDrill(
            "Next 2 weeks",
            "Everything booked from now to two weeks out.",
            () => nextTwoWeeks,
          )}
        />
        <KpiTile
          label="No-shows"
          value={pct(c.noShowRate)}
          detail={`${c.noShows} · deposits paid on ${pct(c.depositRate)} of bookings`}
          drill={bookingDrill(
            "No-shows",
            "Bookings in this period marked as no-show.",
            () => inPeriod.filter((a) => a.status === "no_show"),
          )}
          spark={sparks.noShows}
        />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
        <SectionCard
          title="Best sellers to reorder"
          hint="Sold in the last 90 days and out of stock or nearly gone."
        >
          <StatTable
            rows={[...s.outOfStockSellers, ...s.lowStockSellers]}
            rowKey={(r) => String(r.id)}
            columns={stockColumns}
            onRowClick={(r) => navigate(`/packages/${r.id}/show`)}
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
            onRowClick={(r) => navigate(`/packages/${r.id}/show`)}
            filename="slow-movers.csv"
            empty="Everything on the shelf has sold lately."
          />
        </SectionCard>
      </div>
    </>
  );
};
