import { ChevronDown, Receipt, ShoppingBag } from "lucide-react";
import { type Identifier, useGetList } from "ra-core";
import { useId, useMemo, useState } from "react";
import { Link } from "react-router";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Order } from "../types";
import { cleanPurchaseName, purchaseLedger } from "./purchasesModel";
import {
  formatMoney,
  orderNet,
  orderStatusLabel,
  summarizeLines,
} from "./shopFormat";

const ITEMS_SHOWN = 5;
const ORDERS_SHOWN = 4;

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const statusChip = (order: Order): string => {
  const label = orderStatusLabel(order);
  if (label === "Paid") return "lab-chip lab-chip-bay";
  if (label === "Refunded" || label === "Cancelled")
    return "lab-chip lab-chip-muted";
  return "lab-chip lab-chip-warn";
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-lg font-semibold tabular-nums truncate">{value}</dd>
  </div>
);

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mt-5 mb-1 first:mt-0 leading-tight">
    {children}
  </h2>
);

/**
 * What a customer bought before: lifetime spend, every product they have had
 * from us, and the full order history. Deposits and cancellations are shown
 * but left out of the spend (see purchasesModel.ts).
 */
export const ContactPurchases = ({ contactId }: { contactId: Identifier }) => {
  const ordersBaseId = useId();
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const [openOrders, setOpenOrders] = useState<Record<string, boolean>>({});

  const { data: orders = [], isPending } = useGetList<Order>("orders", {
    filter: { contact_id: contactId },
    sort: { field: "ordered_at", order: "DESC" },
    pagination: { page: 1, perPage: 200 },
  });

  const ledger = useMemo(() => purchaseLedger(orders), [orders]);

  if (isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  if (!ledger.history.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted mb-3">
          <ShoppingBag className="size-6 text-muted-foreground" />
        </span>
        <p className="font-medium">Nothing bought yet</p>
        <p className="text-sm text-muted-foreground max-w-64">
          Shopify orders, quotes and deposits for this customer show up here
          automatically.
        </p>
      </div>
    );
  }

  const { summary, items, history } = ledger;
  const shownItems = itemsExpanded ? items : items.slice(0, ITEMS_SHOWN);
  const shownOrders = ordersExpanded ? history : history.slice(0, ORDERS_SHOWN);
  const allOrdersUrl = `/orders?filter=${encodeURIComponent(
    JSON.stringify({ contact_id: contactId }),
  )}`;

  const toggleOrder = (id: Identifier) =>
    setOpenOrders((open) => ({ ...open, [String(id)]: !open[String(id)] }));

  return (
    <div className="flex flex-col">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 pb-4 border-b border-border">
        <Stat
          label="Lifetime spend"
          value={formatMoney(summary.lifetimeSpend)}
        />
        <Stat
          label={summary.orderCount === 1 ? "Order" : "Orders"}
          value={String(summary.orderCount)}
        />
        <Stat
          label="Last purchase"
          value={
            summary.lastPurchasedAt ? formatDay(summary.lastPurchasedAt) : "—"
          }
        />
        <Stat
          label={summary.distinctItems === 1 ? "Item bought" : "Items bought"}
          value={String(summary.distinctItems)}
        />
      </dl>

      {items.length ? (
        <section aria-labelledby={`${ordersBaseId}-items`}>
          <SectionHeading>
            <span id={`${ordersBaseId}-items`}>Bought before</span>
          </SectionHeading>
          <ul className="divide-y divide-border">
            {shownItems.map((item) => (
              <li
                key={item.name}
                className="flex items-start gap-3 py-2.5 min-h-11"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity > 1 ? `${item.quantity} bought · ` : ""}
                    {item.orders === 1 ? "1 order" : `${item.orders} orders`} ·
                    last{" "}
                    <time dateTime={item.lastPurchasedAt}>
                      {formatDay(item.lastPurchasedAt)}
                    </time>
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums">
                  {formatMoney(item.spent)}
                </span>
              </li>
            ))}
          </ul>
          {items.length > ITEMS_SHOWN ? (
            <button
              type="button"
              className="min-h-11 text-sm text-[var(--lab-blue-text)]"
              aria-expanded={itemsExpanded}
              onClick={() => setItemsExpanded((v) => !v)}
            >
              {itemsExpanded ? "Show fewer" : `Show all ${items.length} items`}
            </button>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby={`${ordersBaseId}-orders`}>
        <SectionHeading>
          <span id={`${ordersBaseId}-orders`}>Order history</span>
        </SectionHeading>
        <ul className="divide-y divide-border">
          {shownOrders.map((order) => {
            const key = String(order.id);
            const open = !!openOrders[key];
            const lines = order.line_items ?? [];
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => toggleOrder(order.id)}
                  aria-expanded={open}
                  aria-controls={`${ordersBaseId}-${key}`}
                  className="flex w-full items-center gap-3 py-2.5 min-h-12 text-left"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <Receipt className="size-4 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      <time dateTime={order.ordered_at}>
                        {formatDay(order.ordered_at)}
                      </time>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {summarizeLines(lines, 2) || order.order_number}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-medium tabular-nums">
                      {formatMoney(orderNet(order), order.currency)}
                    </span>
                    <span className={statusChip(order)}>
                      {orderStatusLabel(order)}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                      open && "rotate-180",
                    )}
                  />
                </button>
                {open ? (
                  <div
                    id={`${ordersBaseId}-${key}`}
                    className="pl-12 pb-3 text-sm"
                  >
                    <p className="text-xs text-muted-foreground mb-1">
                      {order.order_number}
                      {order.is_deposit ? " · Booking deposit" : ""}
                      {order.cancelled_at ? " · Cancelled" : ""}
                    </p>
                    {lines.length ? (
                      <ul className="flex flex-col gap-1">
                        {lines.map((line, i) => (
                          <li
                            key={`${line.name}-${i}`}
                            className="flex items-baseline justify-between gap-3"
                          >
                            <span className="min-w-0 truncate">
                              {line.quantity > 1 ? `${line.quantity} × ` : ""}
                              {cleanPurchaseName(line.name) || line.name}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {formatMoney(
                                (Number(line.price) || 0) *
                                  (Number(line.quantity) || 0),
                                order.currency,
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">
                        No line items on this order.
                      </p>
                    )}
                    <Link
                      to={`/orders?filter=${encodeURIComponent(
                        JSON.stringify({ order_number: order.order_number }),
                      )}`}
                      className="inline-flex min-h-11 items-center text-xs underline underline-offset-4"
                    >
                      Open in Orders
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {history.length > ORDERS_SHOWN ? (
          <button
            type="button"
            className="min-h-11 text-sm text-[var(--lab-blue-text)]"
            aria-expanded={ordersExpanded}
            onClick={() => setOrdersExpanded((v) => !v)}
          >
            {ordersExpanded
              ? "Show fewer"
              : `Show all ${history.length} orders`}
          </button>
        ) : null}
        <div className="pt-1">
          <Link
            to={allOrdersUrl}
            className="inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline text-muted-foreground"
          >
            See these orders in the Orders list
          </Link>
        </div>
      </section>
    </div>
  );
};
