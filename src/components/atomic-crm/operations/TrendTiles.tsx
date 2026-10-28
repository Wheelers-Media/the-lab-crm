import { TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { money } from "./format";
import { KpiTile, SectionTitle } from "./OperationsWidgets";
import { changeOf, type PeriodFigures, type Trends } from "./trendsModel";

const rate = (part: number, whole: number): number | null =>
  whole ? Math.round((part / whole) * 100) : null;

interface Tile {
  label: string;
  value: (f: PeriodFigures) => number | null;
  format: (n: number | null) => string;
  detail: (f: PeriodFigures) => string;
  to: string;
}

const count = (n: number | null) => (n == null ? "-" : String(n));
const percent = (n: number | null) => (n == null ? "-" : `${n}%`);
const dollars = (n: number | null) => (n == null ? "-" : money(n));

const TILES: Tile[] = [
  {
    label: "Sales orders",
    value: (f) => f.salesOrders,
    format: count,
    detail: (f) => `${dollars(f.revenue)} taken`,
    to: "/orders",
  },
  {
    label: "Average ticket",
    value: (f) => f.averageTicket,
    format: dollars,
    detail: () => "Per sales order, deposits left out",
    to: "/numbers",
  },
  {
    label: "New customers",
    value: (f) => f.newCustomers,
    format: count,
    detail: () => "First order ever",
    to: "/numbers",
  },
  {
    label: "Returning customers",
    value: (f) => f.returningCustomers,
    format: count,
    detail: (f) => {
      const share = rate(
        f.returningCustomers,
        f.returningCustomers + f.newCustomers,
      );
      return share == null ? "Bought before" : `${share}% of buyers`;
    },
    to: "/numbers",
  },
  {
    label: "New leads",
    value: (f) => f.leads,
    format: count,
    detail: (f) => `${f.bookedLeads} booked so far`,
    to: "/deals",
  },
  {
    label: "Lead to booked",
    value: (f) => rate(f.bookedLeads, f.leads),
    format: percent,
    detail: (f) => `${f.bookedLeads} of ${f.leads}`,
    to: "/deals",
  },
  {
    label: "Bay booked",
    value: (f) => f.bayUse,
    format: percent,
    detail: () => "Drop-off slots filled, weekdays",
    to: "/calendar",
  },
];

/**
 * The shop's numbers for the period, each against the same point in the
 * period before, so each one says whether things are getting better.
 */
export const TrendTiles = ({
  trends,
  isPending,
  vs,
  pipeline,
}: {
  trends: Trends;
  isPending: boolean;
  /** "vs last month" */
  vs: string;
  /** Open pipeline, which has no history to trend. */
  pipeline: { amount: number; count: number };
}) => {
  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] w-full" />
        ))}
      </div>
    );
  }
  return (
    <section aria-labelledby="trend-tiles" className="flex flex-col gap-2">
      <SectionTitle
        icon={TrendingUp}
        hint={`Each figure ${vs}, compared at the same point in the period.`}
      >
        <span id="trend-tiles">Trending</span>
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((tile) => {
          const current = tile.value(trends.current);
          return (
            <KpiTile
              key={tile.label}
              label={tile.label}
              to={tile.to}
              value={tile.format(current)}
              trend={changeOf(current, tile.value(trends.previous))}
              detail={tile.detail(trends.current)}
            />
          );
        })}
        <KpiTile
          label="Open pipeline"
          to="/deals"
          value={money(pipeline.amount)}
          detail={`${pipeline.count} open jobs`}
        />
      </div>
    </section>
  );
};
