import { RecordContextProvider } from "ra-core";
import { useMemo } from "react";

import { useAllRecords } from "../numbers/useAllRecords";
import { money } from "../operations/format";
import { ContactLink } from "../shop/ContactLink";
import { formatMoney } from "../shop/shopFormat";
import type { Package } from "../types";
import { type SalesStats, salesStats } from "./productModel";

export type OrderLine = {
  id: string;
  order_id: number;
  order_number: string;
  contact_id: number | null;
  ordered_at: string;
  cancelled_at: string | null;
  name: string;
  quantity: number;
  price: number;
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** Order lines naming this product (any option), newest first. */
export const useProductLines = (pkg: Package) => {
  // Every word of the short title; a line's name may add the option or a brand
  const words = pkg.title
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
    .join(" ");
  const { data = [], isPending } = useAllRecords<OrderLine>("order_lines", {
    filter: { "name@ilike": `*${words}*`, "cancelled_at@is": null },
    sort: { field: "ordered_at", order: "DESC" },
    enabled: Boolean(words),
  });
  return { lines: data, isPending };
};

const Stat = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) => (
  <div className="flex flex-col rounded-md bg-muted/50 px-3 py-2">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="lab-num text-lg font-semibold">{value}</span>
    {detail ? (
      <span className="lab-num text-xs text-muted-foreground">{detail}</span>
    ) : null}
  </div>
);

const MonthlyBars = ({ months }: { months: SalesStats["monthly"] }) => {
  const max = Math.max(1, ...months.map((m) => m.units));
  return (
    <div
      className="flex h-16 items-end gap-1"
      role="img"
      aria-label="Units sold per month, last 12 months"
    >
      {months.map((m) => (
        <div
          key={m.key}
          title={`${m.key}: ${m.units} sold`}
          className="flex-1 rounded-sm bg-primary/70"
          style={{
            height: `${Math.max(m.units ? 8 : 2, (m.units / max) * 100)}%`,
            opacity: m.units ? 1 : 0.25,
          }}
        />
      ))}
    </div>
  );
};

/** How well it sells, and who bought it. */
export const ProductSales = ({ pkg }: { pkg: Package }) => {
  const { lines, isPending } = useProductLines(pkg);
  const stats = useMemo(() => salesStats(lines), [lines]);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg">Sales</h2>
      {lines.length ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label="Last 30 days"
              value={`${stats.units.d30} sold`}
              detail={money(stats.revenue.d30)}
            />
            <Stat
              label="Last 90 days"
              value={`${stats.units.d90} sold`}
              detail={money(stats.revenue.d90)}
            />
            <Stat
              label="Last 12 months"
              value={`${stats.units.d365} sold`}
              detail={money(stats.revenue.d365)}
            />
            <Stat
              label="All time"
              value={`${stats.units.all} sold`}
              detail={`${stats.customers} customer${stats.customers === 1 ? "" : "s"}`}
            />
          </div>
          <div>
            <MonthlyBars months={stats.monthly} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats.monthly[0]?.key}</span>
              <span>
                {stats.lastSoldAt
                  ? `Last sold ${shortDate(stats.lastSoldAt)}`
                  : ""}
              </span>
              <span>{stats.monthly[11]?.key}</span>
            </div>
          </div>
          <h3 className="pt-2 text-sm font-medium text-muted-foreground">
            Customers who bought it
          </h3>
          <ul className="divide-y divide-border">
            {lines.slice(0, 15).map((line) => (
              <RecordContextProvider key={line.id} value={line}>
                <li className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">
                      <ContactLink fallback="In-shop sale, no customer" />
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {line.quantity > 1 ? `${line.quantity} × ` : ""}
                      {line.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    {shortDate(line.ordered_at)} · {line.order_number}
                    <span className="lab-num block">
                      {formatMoney(line.price * line.quantity)}
                    </span>
                  </span>
                </li>
              </RecordContextProvider>
            ))}
          </ul>
          {lines.length > 15 ? (
            <p className="text-xs text-muted-foreground">
              Newest 15 of {lines.length} order lines.
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {isPending ? "Loading..." : "No Shopify orders with this item yet."}
        </p>
      )}
    </section>
  );
};
