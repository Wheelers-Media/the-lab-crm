import { RecordContextProvider } from "ra-core";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "@/components/ui/card";

import { MobileFilterChip, MobileListPage } from "../layout/MobileListPage";
import { ActionRow } from "../misc/ActionRow";
import type { Order, ShopifyCheckout } from "../types";
import { BIG_CART_THRESHOLD, CartFollowUp } from "./CheckoutList";
import { CheckoutDetail } from "./CheckoutDetail";
import { ContactLink } from "./ContactLink";
import { ReviewAskButton } from "./ReviewAskButton";
import {
  formatMoney,
  orderNet,
  orderStatusLabel,
  summarizeLines,
} from "./shopFormat";
import { useCartActions, useOrderActions } from "./useShopActions";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const OrderCard = ({ order }: { order: Order }) => {
  const status = orderStatusLabel(order);
  const actions = useOrderActions(order);
  const navigate = useNavigate();
  const open = () => navigate(`/orders/${order.id}/show`);
  return (
    <RecordContextProvider value={order}>
      <ActionRow
        title={`Order #${order.order_number.replace(/^#/, "")}`}
        subtitle={formatMoney(orderNet(order), order.currency)}
        actions={actions}
      >
        <Card
          className="p-3 gap-1"
          role="button"
          tabIndex={0}
          aria-label={`Open order ${order.order_number}`}
          onClick={open}
          onKeyDown={(e) => e.key === "Enter" && open()}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display uppercase tracking-wide">
              #{order.order_number.replace(/^#/, "")}
            </span>
            <span className="lab-num font-semibold">
              {formatMoney(orderNet(order), order.currency)}
            </span>
          </div>
          <div
            className="text-sm truncate"
            onClick={(e) => e.stopPropagation()}
          >
            <ContactLink />
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {summarizeLines(order.line_items, 2)}
          </p>
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <span className="text-xs text-muted-foreground">
              {shortDate(order.ordered_at)}
            </span>
            <span
              className={`lab-chip ${status === "Paid" ? "lab-chip-bay" : "lab-chip-warn"}`}
            >
              {status}
            </span>
            {order.is_deposit ? (
              <span className="lab-chip lab-chip-eric">Deposit</span>
            ) : null}
          </div>
          <div className="pt-1">
            <ReviewAskButton order={order} />
          </div>
        </Card>
      </ActionRow>
    </RecordContextProvider>
  );
};

export const MobileOrderList = () => (
  <MobileListPage<Order>
    resource="orders"
    title="Orders"
    sort={{ field: "ordered_at", order: "DESC" }}
    empty="No Shopify orders yet."
    toolbar={
      <div className="flex flex-wrap gap-2">
        <MobileFilterChip label="Deposits" value={{ is_deposit: true }} />
        <MobileFilterChip
          label="No customer linked"
          value={{ "contact_id@is": null }}
        />
      </div>
    }
    renderItem={(order) => <OrderCard order={order} />}
  />
);

const CheckoutCard = ({ checkout }: { checkout: ShopifyCheckout }) => {
  const big = checkout.total >= BIG_CART_THRESHOLD;
  const { actions, swipeLeft, swipeRight } = useCartActions(checkout);
  const [open, setOpen] = useState(false);
  return (
    <RecordContextProvider value={checkout}>
      <CheckoutDetail
        checkout={open ? checkout : null}
        onClose={() => setOpen(false)}
      />
      <ActionRow
        title={checkout.customer_name || checkout.email || "Abandoned cart"}
        subtitle={formatMoney(checkout.total)}
        actions={actions}
        swipeLeft={swipeLeft}
        swipeRight={swipeRight}
      >
        <Card
          className={`p-3 gap-1 ${big ? "lab-bay-parts" : ""}`}
          role="button"
          tabIndex={0}
          aria-label={`Open cart for ${checkout.customer_name || checkout.email || "customer"}`}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Enter" && setOpen(true)}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm truncate">
              <ContactLink
                fallback={
                  checkout.customer_name || checkout.email || checkout.phone
                }
              />
            </span>
            <span className={`lab-num ${big ? "font-semibold" : ""}`}>
              {formatMoney(checkout.total)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {summarizeLines(checkout.line_items, 3)}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">
              {shortDate(checkout.checkout_updated_at)}
            </span>
            {big ? (
              <span className="lab-chip lab-chip-warn">Call personally</span>
            ) : null}
            {checkout.task_id != null ? (
              <span className="lab-chip lab-chip-muted">Call task added</span>
            ) : null}
          </div>
          <div className="pt-2" onClick={(e) => e.stopPropagation()}>
            <CartFollowUp checkout={checkout} />
          </div>
        </Card>
      </ActionRow>
    </RecordContextProvider>
  );
};

export const MobileCheckoutList = () => (
  <MobileListPage<ShopifyCheckout>
    resource="shopify_checkouts"
    title="Abandoned carts"
    filter={{ "completed_at@is": null }}
    sort={{ field: "checkout_updated_at", order: "DESC" }}
    empty="No abandoned carts."
    toolbar={
      <MobileFilterChip
        label="$2,000 and up"
        value={{ "total@gte": BIG_CART_THRESHOLD }}
      />
    }
    renderItem={(checkout) => <CheckoutCard checkout={checkout} />}
  />
);
