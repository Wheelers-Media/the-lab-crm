import { MessageSquare, Phone } from "lucide-react";
import { RecordContextProvider } from "ra-core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { MobileFilterChip, MobileListPage } from "../layout/MobileListPage";
import type { Order, ShopifyCheckout } from "../types";
import { BIG_CART_THRESHOLD, RecoveryLink } from "./CheckoutList";
import { ContactLink } from "./ContactLink";
import {
  formatMoney,
  orderNet,
  orderStatusLabel,
  summarizeLines,
} from "./shopFormat";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const OrderCard = ({ order }: { order: Order }) => {
  const status = orderStatusLabel(order);
  return (
    <RecordContextProvider value={order}>
      <Card className="p-3 gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display uppercase tracking-wide">
            #{order.order_number.replace(/^#/, "")}
          </span>
          <span className="lab-num font-semibold">
            {formatMoney(orderNet(order), order.currency)}
          </span>
        </div>
        <div className="text-sm truncate">
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
      </Card>
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
  const phone = checkout.phone?.replace(/[^\d+]/g, "");
  return (
    <RecordContextProvider value={checkout}>
      <Card className={`p-3 gap-1 ${big ? "lab-bay-parts" : ""}`}>
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
        <div className="flex flex-wrap gap-2 pt-2">
          {phone ? (
            <>
              <Button asChild size="sm" variant="outline">
                <a href={`tel:${phone}`}>
                  <Phone className="size-3.5" />
                  Call
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={`sms:${phone}`}>
                  <MessageSquare className="size-3.5" />
                  Text
                </a>
              </Button>
            </>
          ) : null}
          <RecoveryLink url={checkout.recovery_url} />
        </div>
      </Card>
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
