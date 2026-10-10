import { BadgeCheck, Sparkles } from "lucide-react";
import { type Identifier, useGetList } from "ra-core";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Order, Package } from "../types";
import {
  type CustomerService,
  catalogIndex,
  membershipStatus,
  servicesFromOrders,
} from "./packageModel";

const SHOWN = 8;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const money = (n: number) =>
  n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

/**
 * What the customer has had done: every package and part from their Shopify
 * orders, how often, when last and what they paid, plus membership status.
 */
export const CustomerPackages = ({
  contact,
}: {
  contact: Pick<Contact, "id" | "membership" | "membership_since">;
}) => {
  const [showAll, setShowAll] = useState(false);
  const { dealCategories } = useConfigurationContext();
  const { data: orders = [], isPending } = useGetList<Order>("orders", {
    filter: { contact_id: contact.id as Identifier },
    sort: { field: "ordered_at", order: "DESC" },
    pagination: { page: 1, perPage: 500 },
  });
  const { data: catalog = [] } = useGetList<Package>("packages", {
    pagination: { page: 1, perPage: 2000 },
    sort: { field: "title", order: "ASC" },
  });

  const services = useMemo(() => servicesFromOrders(orders), [orders]);
  const lookup = useMemo(() => catalogIndex(catalog), [catalog]);
  const membership = membershipStatus(contact, services);
  const lastDetail = services.find(
    (s) => lookup(s.name)?.category === "detailing",
  );

  if (isPending) return null;
  if (!services.length && !membership) {
    return (
      <p className="text-muted-foreground">
        No packages yet. Shopify orders show up here.
      </p>
    );
  }

  const label = (value?: string | null) =>
    dealCategories.find((c) => c.value === value)?.label;
  const shown = showAll ? services : services.slice(0, SHOWN);

  return (
    <div className="flex flex-col gap-3">
      {membership || lastDetail ? (
        <div className="flex flex-wrap gap-1">
          {membership ? (
            <span
              className={`lab-chip ${membership.active ? "lab-chip-boutique" : "lab-chip-muted"}`}
            >
              <BadgeCheck className="w-3 h-3" />
              {membership.label}
            </span>
          ) : null}
          {lastDetail ? (
            <span className="lab-chip lab-chip-muted">
              <Sparkles className="w-3 h-3" />
              Last detail {shortDate(lastDetail.lastDate)}
            </span>
          ) : null}
        </div>
      ) : null}
      <ul className="flex flex-col gap-2">
        {shown.map((service) => (
          <ServiceRow
            key={service.name}
            service={service}
            pkg={lookup(service.name)}
            categoryLabel={label(lookup(service.name)?.category)}
          />
        ))}
      </ul>
      {services.length > SHOWN ? (
        <button
          type="button"
          className="text-xs underline self-start"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show less" : `Show all ${services.length}`}
        </button>
      ) : null}
    </div>
  );
};

const ServiceRow = ({
  service,
  pkg,
  categoryLabel,
}: {
  service: CustomerService;
  pkg?: Package;
  categoryLabel?: string;
}) => (
  <li className="flex justify-between gap-3">
    <div className="min-w-0">
      <div className="truncate">
        {service.times > 1 ? `${service.times} × ` : ""}
        {pkg ? (
          <Link to={`/packages/${pkg.id}/show`} className="hover:underline">
            {service.name}
          </Link>
        ) : (
          service.name
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {categoryLabel ? (
          <span
            className={`lab-chip ${pkg?.bay === "parts" ? "lab-chip-parts" : "lab-chip-boutique"}`}
          >
            {categoryLabel}
          </span>
        ) : null}
        <span>Last {shortDate(service.lastDate)}</span>
      </div>
    </div>
    <span className="lab-num shrink-0">{money(service.spent)}</span>
  </li>
);
