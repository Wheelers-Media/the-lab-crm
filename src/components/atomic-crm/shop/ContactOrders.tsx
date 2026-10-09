import { useGetList, useTranslate } from "ra-core";
import { Link } from "react-router";

import type { Identifier } from "ra-core";
import type { Order } from "../types";
import {
  formatMoney,
  orderNet,
  customerSpend,
  summarizeLines,
} from "./shopFormat";

const SHOWN = 5;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

/** Lifetime spend and recent Shopify orders for one contact. */
export const ContactOrders = ({ contactId }: { contactId: Identifier }) => {
  const translate = useTranslate();
  const { data: orders = [], isPending } = useGetList<Order>("orders", {
    filter: { contact_id: contactId },
    sort: { field: "ordered_at", order: "DESC" },
    pagination: { page: 1, perPage: 200 },
  });

  if (isPending) return null;
  if (orders.length === 0) {
    return (
      <p className="text-muted-foreground">
        {translate("resources.orders.empty_contact", {
          _: "No Shopify orders yet.",
        })}
      </p>
    );
  }

  const spend = customerSpend(orders);
  const allOrdersUrl = `/orders?filter=${encodeURIComponent(
    JSON.stringify({ contact_id: contactId }),
  )}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-semibold tabular-nums">
          {formatMoney(spend.lifetime)}
        </span>
        <span className="text-xs text-muted-foreground">
          {translate("resources.orders.lifetime", {
            smart_count: spend.orderCount,
            _: "%{smart_count} order |||| %{smart_count} orders",
          })}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {orders.slice(0, SHOWN).map((o) => (
          <li key={o.id} className="flex justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate">
                {summarizeLines(o.line_items, 1) || o.order_number}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(o.ordered_at)} · {o.order_number}
                {o.is_deposit &&
                  ` · ${translate("resources.orders.deposit", { _: "Deposit" })}`}
                {o.cancelled_at &&
                  ` · ${translate("resources.orders.cancelled", { _: "Cancelled" })}`}
              </div>
            </div>
            <span className="tabular-nums shrink-0">
              {formatMoney(orderNet(o), o.currency)}
            </span>
          </li>
        ))}
      </ul>
      {orders.length > SHOWN && (
        <Link to={allOrdersUrl} className="text-xs underline">
          {translate("resources.orders.see_all", {
            smart_count: orders.length,
            _: "See all %{smart_count} orders",
          })}
        </Link>
      )}
    </div>
  );
};
