import { useMemo } from "react";

import { cartStats, percentChange } from "../operations/metrics";
import { money } from "../operations/format";
import { KpiTile } from "../operations/OperationsWidgets";
import type { Deal, ShopifyCheckout } from "../types";
import {
  leadFunnel,
  responseSpeed,
  type SourceRow,
  type StageChange,
} from "./funnelModel";
import type { NumbersRanges } from "./periods";
import type { Column } from "./widgets";
import { SectionCard, StatTable } from "./widgets";

const hoursText = (hours: number | null): string => {
  if (hours == null) return "–";
  if (hours < 1) return "under 1 h";
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${(hours / 24).toFixed(1)} days`;
};

const pct = (n: number, of: number) =>
  of ? `${Math.round((n / of) * 100)}%` : "–";

export const PipelineSection = ({
  deals,
  changes,
  checkouts,
  ranges,
  now,
}: {
  deals: Deal[];
  changes: StageChange[];
  checkouts: ShopifyCheckout[];
  ranges: NumbersRanges;
  now: Date;
}) => {
  const data = useMemo(
    () => ({
      funnel: leadFunnel(deals, changes, ranges.current),
      speed: responseSpeed(deals, changes, ranges.current),
      carts: cartStats(checkouts, ranges.current, now),
      cartsBefore: cartStats(checkouts, ranges.previous, now),
    }),
    [deals, changes, checkouts, ranges, now],
  );
  const { total } = data.funnel;
  const rows = [...data.funnel.rows, total];

  const columns: Array<Column<SourceRow>> = [
    { header: "Source", value: (r) => r.source },
    { header: "Leads", value: (r) => r.leads, numeric: true },
    {
      header: "Quoted",
      value: (r) => r.quoted,
      display: (r) => `${r.quoted} (${pct(r.quoted, r.leads)})`,
      numeric: true,
    },
    {
      header: "Booked",
      value: (r) => r.booked,
      display: (r) => `${r.booked} (${pct(r.booked, r.leads)})`,
      numeric: true,
    },
    {
      header: "Converted",
      value: (r) => r.converted,
      display: (r) => `${r.converted} (${r.conversion ?? "–"}%)`,
      numeric: true,
    },
    { header: "Not now", value: (r) => r.lost, numeric: true },
    {
      header: "Converted value",
      value: (r) => r.value,
      display: (r) => money(r.value),
      numeric: true,
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiTile
          label="New leads"
          value={String(total.leads)}
          detail="requests and bookings started"
        />
        <KpiTile
          label="Lead to converted"
          value={total.conversion == null ? "–" : `${total.conversion}%`}
          detail={`${total.converted} of ${total.leads}`}
        />
        <KpiTile
          label="Time to quote"
          value={hoursText(data.speed.quoteHours)}
          detail={`median of ${data.speed.quotedCount} quoted`}
        />
        <KpiTile
          label="Time to convert"
          value={
            data.speed.convertDays == null
              ? "–"
              : `${data.speed.convertDays.toFixed(1)} days`
          }
          detail={`median of ${data.speed.convertedCount} converted`}
        />
        <KpiTile
          label="Abandoned carts"
          value={String(data.carts.abandoned)}
          trend={percentChange(
            data.carts.abandonedValue,
            data.cartsBefore.abandonedValue,
          )}
          detail={`${money(data.carts.abandonedValue)} · ${data.carts.completionRate ?? "–"}% finish`}
        />
      </div>
      <SectionCard
        title="Where leads come from"
        hint="Quoted and booked count every job that got that far, even if it was later moved to Not now."
      >
        <StatTable
          rows={rows}
          rowKey={(r) => r.source}
          columns={columns}
          filename="lead-funnel.csv"
          limit={20}
          empty="No leads in this period."
        />
      </SectionCard>
    </>
  );
};
