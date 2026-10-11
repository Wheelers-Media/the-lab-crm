import { useMemo } from "react";
import { Link } from "react-router";

import { firstPhone } from "../contacts/firstPhone";
import { contactName, money } from "../operations/format";
import { KpiTile } from "../operations/OperationsWidgets";
import {
  customerLedger,
  customerStats,
  type LedgerOrder,
  type LedgerRow,
  quietCustomers,
  topSpenders,
} from "./customerModel";
import type { NumbersRanges } from "./periods";
import { useCustomerNames } from "./useNumbersData";
import type { Column } from "./widgets";
import { SectionCard, StatTable } from "./widgets";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const CustomersSection = ({
  orders,
  ranges,
  now,
}: {
  orders: LedgerOrder[];
  ranges: NumbersRanges;
  now: Date;
}) => {
  const data = useMemo(() => {
    const ledger = customerLedger(orders);
    return {
      stats: customerStats(orders, ranges.current),
      before: customerStats(orders, ranges.previous),
      top: topSpenders(ledger, 25),
      quiet: quietCustomers(ledger, now),
    };
  }, [orders, ranges, now]);
  const { stats: s } = data;
  const listed = [...data.top, ...data.quiet.slipping.slice(0, 25)];
  const contacts = useCustomerNames(listed.map((r) => r.contactId));

  const nameOf = (r: LedgerRow) =>
    contactName(contacts.get(r.contactId)) || `Customer ${r.contactId}`;
  const customerCell = (r: LedgerRow) => (
    <Link to={`/contacts/${r.contactId}/show`} className="hover:underline">
      {nameOf(r)}
    </Link>
  );
  const base: Array<Column<LedgerRow>> = [
    { header: "Customer", value: nameOf, display: customerCell },
    { header: "Orders", value: (r) => r.orders, numeric: true },
    {
      header: "Lifetime spend",
      value: (r) => Math.round(r.spend),
      display: (r) => money(r.spend),
      numeric: true,
    },
    {
      header: "Last order",
      value: (r) => r.lastOrderAt.slice(0, 10),
      display: (r) => day(r.lastOrderAt),
      numeric: true,
    },
  ];
  const quietColumns: Array<Column<LedgerRow>> = [
    ...base,
    {
      header: "Phone",
      value: (r) => {
        const c = contacts.get(r.contactId);
        return c ? (firstPhone(c) ?? "") : "";
      },
      display: (r) => {
        const c = contacts.get(r.contactId);
        const phone = c ? firstPhone(c) : null;
        return phone ? (
          <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="underline">
            {phone}
          </a>
        ) : (
          "–"
        );
      },
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiTile
          label="Customers who ordered"
          value={String(s.active)}
          detail="in this period"
        />
        <KpiTile
          label="New customers"
          value={String(s.newCustomers)}
          detail={`${money(s.newCollected)} collected`}
        />
        <KpiTile
          label="Returning"
          value={String(s.returning)}
          detail={`${s.repeatRate == null ? "–" : `${s.repeatRate}%`} of customers · ${money(s.returningCollected)}`}
        />
        <KpiTile
          label="Average lifetime spend"
          value={
            s.averageLifetimeSpend == null ? "–" : money(s.averageLifetimeSpend)
          }
          detail={
            s.averageOrdersPerCustomer == null
              ? ""
              : `${s.averageOrdersPerCustomer.toFixed(1)} orders each`
          }
        />
        <KpiTile
          label="Sold without a customer"
          value={s.unidentifiedShare == null ? "–" : `${s.unidentifiedShare}%`}
          detail="of orders, mostly in-shop sales"
        />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard
          title="Top customers"
          hint="By money collected over their lifetime, refunds taken off."
        >
          <StatTable
            rows={data.top}
            rowKey={(r) => String(r.contactId)}
            columns={base}
            filename="top-customers.csv"
          />
        </SectionCard>
        <SectionCard
          title="Repeat customers gone quiet"
          hint={`Bought more than once, nothing in 6 to 12 months (${data.quiet.slipping.length}). ${data.quiet.lapsed.length} more have been quiet over a year.`}
        >
          <StatTable
            rows={data.quiet.slipping.slice(0, 25)}
            rowKey={(r) => String(r.contactId)}
            columns={quietColumns}
            filename="customers-gone-quiet.csv"
            empty="No repeat customers have gone quiet."
          />
        </SectionCard>
      </div>
    </>
  );
};
