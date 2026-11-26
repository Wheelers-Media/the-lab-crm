import { useMemo, useState } from "react";

import { cartStats, percentChange } from "../operations/metrics";
import type { DrillContent } from "../operations/DrillSheet";
import { money } from "../operations/format";
import { inRange } from "../operations/shopTime";
import { CheckoutDetail } from "../shop/CheckoutDetail";
import { KpiTile } from "../operations/OperationsWidgets";
import type { Deal, ShopifyCheckout } from "../types";
import {
  leadFunnel,
  responseSpeed,
  type SourceRow,
  type StageChange,
} from "./funnelModel";
import { cartRows, dealRows } from "./drillRows";
import { bucketSeries } from "./seriesModel";
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
  const [openCart, setOpenCart] = useState<ShopifyCheckout | null>(null);
  const leads = useMemo(
    () => deals.filter((d) => inRange(d.created_at, ranges.current)),
    [deals, ranges],
  );
  const converted = leads.filter((d) => d.stage === "won");
  const abandoned = useMemo(
    () =>
      checkouts.filter(
        (c) =>
          !c.completed_at &&
          inRange(c.checkout_updated_at, ranges.current) &&
          now.getTime() - new Date(c.checkout_updated_at).getTime() > 3_600_000,
      ),
    [checkouts, ranges, now],
  );
  const sparks = useMemo(
    () => ({
      leads: bucketSeries(
        deals,
        (d) => d.created_at,
        () => 1,
        ranges,
      ),
      converted: bucketSeries(
        deals.filter((d) => d.stage === "won"),
        (d) => d.created_at,
        () => 1,
        ranges,
      ),
      carts: bucketSeries(
        checkouts.filter((c) => !c.completed_at),
        (c) => c.checkout_updated_at,
        () => 1,
        ranges,
      ),
    }),
    [deals, checkouts, ranges],
  );
  const dealDrill =
    (title: string, description: string, list: () => Deal[]) =>
    (): DrillContent => ({
      title,
      description,
      empty: "No jobs in this group for this period.",
      rows: dealRows(list()),
    });
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
      <CheckoutDetail checkout={openCart} onClose={() => setOpenCart(null)} />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiTile
          label="New leads"
          value={String(total.leads)}
          detail="requests and bookings started"
          drill={dealDrill(
            "New leads",
            "Every request and booking that started in this period, newest first.",
            () => leads,
          )}
          spark={sparks.leads}
        />
        <KpiTile
          label="Lead to converted"
          value={total.conversion == null ? "–" : `${total.conversion}%`}
          detail={`${total.converted} of ${total.leads}`}
          drill={dealDrill(
            "Converted jobs",
            "Jobs that started in this period and are now Converted.",
            () => converted,
          )}
          spark={sparks.converted}
        />
        <KpiTile
          label="Time to quote"
          value={hoursText(data.speed.quoteHours)}
          detail={`median of ${data.speed.quotedCount} quoted`}
          drill={dealDrill(
            "Leads waiting on a quote",
            "Jobs from this period. Open one to see when it was quoted.",
            () => leads,
          )}
        />
        <KpiTile
          label="Time to convert"
          value={
            data.speed.convertDays == null
              ? "–"
              : `${data.speed.convertDays.toFixed(1)} days`
          }
          detail={`median of ${data.speed.convertedCount} converted`}
          drill={dealDrill(
            "Converted jobs",
            "The jobs behind the time to convert.",
            () => converted,
          )}
        />
        <KpiTile
          label="Abandoned carts"
          value={String(data.carts.abandoned)}
          trend={percentChange(
            data.carts.abandonedValue,
            data.cartsBefore.abandonedValue,
          )}
          detail={`${money(data.carts.abandonedValue)} · ${data.carts.completionRate ?? "–"}% finish`}
          drill={() => ({
            title: "Abandoned carts",
            description:
              "Carts left unpaid for over an hour in this period. Tap one to call, text or open the cart.",
            empty: "No abandoned carts in this period.",
            rows: cartRows(abandoned, setOpenCart),
          })}
          spark={sparks.carts}
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
