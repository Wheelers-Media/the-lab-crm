import { ExternalLink, UserRound } from "lucide-react";
import { ShowBase, useRecordContext } from "ra-core";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import type { Order } from "../types";
import { ContactLink } from "./ContactLink";
import { ReviewAskButton } from "./ReviewAskButton";
import {
  formatMoney,
  orderNet,
  orderStatusLabel,
  SHOPIFY_ADMIN,
} from "./shopFormat";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const OrderBody = () => {
  const order = useRecordContext<Order>();
  if (!order) return null;
  const shopifyId = /^\d+$/.test(order.shopify_order_id ?? "")
    ? order.shopify_order_id
    : null;
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="flex flex-wrap items-center gap-2">
          Order {order.order_number}
          <span className="lab-chip lab-chip-muted">
            {orderStatusLabel(order)}
          </span>
          {order.is_deposit ? (
            <span className="lab-chip lab-chip-eric">Deposit</span>
          ) : null}
        </h2>
        <p className="text-sm text-muted-foreground">
          {when(order.ordered_at)}
          {order.source ? ` · ${order.source}` : ""}
        </p>
      </header>

      <section className="flex flex-col gap-1">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
          Customer
        </h3>
        <ContactLink />
        {order.contact_id != null ? (
          <Link
            to={`/contacts/${order.contact_id}/show`}
            className="inline-flex items-center gap-1 text-sm text-[var(--lab-blue-text)]"
          >
            <UserRound className="size-3.5" aria-hidden />
            Open the customer's page
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            No customer linked (usually an in-shop sale).
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
          What was bought
        </h3>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {(order.line_items ?? []).map((line, i) => (
            <li key={i} className="flex items-baseline gap-3 p-3 text-sm">
              <span className="flex-1">
                {line.name}
                {line.sku ? (
                  <span className="block text-xs text-muted-foreground">
                    {line.sku}
                  </span>
                ) : null}
              </span>
              <span className="lab-num text-muted-foreground">
                ×{line.quantity || 1}
              </span>
              <span className="lab-num font-medium">
                {formatMoney(
                  (Number(line.price) || 0) * (Number(line.quantity) || 1),
                  order.currency,
                )}
              </span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-1 text-sm">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="lab-num text-right">
            {formatMoney(order.total, order.currency)}
          </dd>
          {Number(order.refunded_amount) > 0 ? (
            <>
              <dt className="text-muted-foreground">Refunded</dt>
              <dd className="lab-num text-right">
                {formatMoney(order.refunded_amount, order.currency)}
              </dd>
            </>
          ) : null}
          <dt className="font-medium">Kept</dt>
          <dd className="lab-num text-right font-medium">
            {formatMoney(orderNet(order), order.currency)}
          </dd>
        </dl>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <ReviewAskButton order={order} />
        {shopifyId ? (
          <Button asChild size="sm" variant="outline">
            <a
              href={`${SHOPIFY_ADMIN}/orders/${shopifyId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-4" aria-hidden />
              Open in Shopify
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
};

/** One order in full, opened from the Orders list, a customer or any number's detail. */
export const OrderShow = () => (
  <div className="mx-auto flex max-w-xl flex-col gap-3 py-2">
    <Link
      to="/orders"
      className="text-sm text-muted-foreground hover:text-foreground"
    >
      ‹ All orders
    </Link>
    <ShowBase>
      <Card className="p-5">
        <OrderBody />
      </Card>
    </ShowBase>
  </div>
);
