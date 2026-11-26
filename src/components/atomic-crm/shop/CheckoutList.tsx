import { useListContext, useTranslate } from "ra-core";
import { useState } from "react";
import { ExternalLink, MessageSquare, Phone } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { QuickFilter } from "./QuickFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { TopToolbar } from "../layout/TopToolbar";
import type { ShopifyCheckout } from "../types";
import { agoLabel, cartHeat, cartTotals, HEAT_LABEL } from "./cartModel";
import { CheckoutDetail } from "./CheckoutDetail";
import { ContactLink } from "./ContactLink";
import { formatMoney, summarizeLines } from "./shopFormat";

/** Carts at or above this total get a "Call" task for Eric (see run_automations). */
export const BIG_CART_THRESHOLD = 2000;

const CheckoutListActions = () => {
  const translate = useTranslate();
  return (
    <TopToolbar>
      <QuickFilter
        label={translate("resources.shopify_checkouts.filters.big", {
          _: "$2,000 and up",
        })}
        value={{ "total@gte": BIG_CART_THRESHOLD }}
      />
    </TopToolbar>
  );
};

export const RecoveryLink = ({ url }: { url: string | null }) => {
  const translate = useTranslate();
  // Webhook data: only ever link to a real https address
  if (!url || !/^https:\/\//i.test(url)) return null;
  return (
    <Button asChild variant="outline" size="sm">
      <a href={url} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="size-3.5" />
        {translate("resources.shopify_checkouts.action.open_cart", {
          _: "Open cart",
        })}
      </a>
    </Button>
  );
};

/**
 * Call, Text and Open cart for one abandoned cart: the same three on a phone
 * and on a desk, so following up never depends on which one is to hand.
 */
export const CartFollowUp = ({ checkout }: { checkout: ShopifyCheckout }) => {
  const phone = checkout.phone?.replace(/[^\d+]/g, "");
  return (
    <div className="flex flex-wrap gap-2">
      {phone ? (
        <>
          <Button asChild size="sm" variant="outline">
            <a href={`tel:${phone}`}>
              <Phone className="size-3.5" aria-hidden />
              Call
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={`sms:${phone}`}>
              <MessageSquare className="size-3.5" aria-hidden />
              Text
            </a>
          </Button>
        </>
      ) : null}
      <RecoveryLink url={checkout.recovery_url} />
    </div>
  );
};

/** What is sitting in carts right now, above the list. */
const CartSummary = () => {
  const { data = [] } = useListContext<ShopifyCheckout>();
  const totals = cartTotals(data);
  if (!totals.count) return null;
  return (
    <p className="mb-3 text-sm text-muted-foreground">
      <span className="lab-num font-semibold text-foreground">
        {formatMoney(totals.value)}
      </span>{" "}
      across {totals.count} cart{totals.count === 1 ? "" : "s"} on this page ·{" "}
      {totals.hot} left today
      {totals.unreachable
        ? ` · ${totals.unreachable} with no phone or email`
        : ""}
      . Click a cart for what was in it and a text ready to send.
    </p>
  );
};

/** Checkouts the customer started but never paid for. */
export const CheckoutList = () => {
  const translate = useTranslate();
  const [selected, setSelected] = useState<ShopifyCheckout | null>(null);
  return (
    <List
      actions={<CheckoutListActions />}
      filter={{ "completed_at@is": null }}
      sort={{ field: "checkout_updated_at", order: "DESC" }}
      perPage={50}
    >
      <CartSummary />
      <CheckoutDetail checkout={selected} onClose={() => setSelected(null)} />
      <DataTable<ShopifyCheckout>
        bulkActionButtons={false}
        rowClick={(_id, _resource, record) => {
          setSelected(record as ShopifyCheckout);
          return false;
        }}
      >
        <DataTable.Col<ShopifyCheckout>
          source="checkout_updated_at"
          label="resources.shopify_checkouts.fields.checkout_updated_at"
          render={(c) => (
            <div className="flex flex-col">
              <span>{agoLabel(c.checkout_updated_at)}</span>
              <span className="text-xs text-muted-foreground">
                {HEAT_LABEL[cartHeat(c)]}
              </span>
            </div>
          )}
        />
        <DataTable.Col<ShopifyCheckout>
          label="resources.shopify_checkouts.fields.customer"
          disableSort
          render={(c) => (
            <div className="flex flex-col">
              <ContactLink fallback={c.customer_name || c.email || c.phone} />
              {c.contact_id != null && (c.phone || c.email) && (
                <span className="text-xs text-muted-foreground">
                  {c.phone || c.email}
                </span>
              )}
            </div>
          )}
        />
        <DataTable.Col<ShopifyCheckout>
          label="resources.shopify_checkouts.fields.line_items"
          disableSort
          render={(c) => (
            <span className="text-sm">{summarizeLines(c.line_items, 3)}</span>
          )}
        />
        <DataTable.Col<ShopifyCheckout>
          source="total"
          label="resources.shopify_checkouts.fields.total"
          headerClassName="text-right"
          cellClassName="text-right tabular-nums"
          render={(c) => (
            <span
              className={
                c.total >= BIG_CART_THRESHOLD ? "font-semibold" : undefined
              }
            >
              {formatMoney(c.total)}
            </span>
          )}
        />
        <DataTable.Col<ShopifyCheckout>
          label="resources.shopify_checkouts.fields.follow_up"
          disableSort
          render={(c) =>
            c.task_id != null ? (
              <Badge variant="outline">
                {translate("resources.shopify_checkouts.call_task", {
                  _: "Call task added",
                })}
              </Badge>
            ) : null
          }
        />
        <DataTable.Col<ShopifyCheckout>
          label={false}
          disableSort
          render={(c) => (
            <div onClick={(e) => e.stopPropagation()}>
              <CartFollowUp checkout={c} />
            </div>
          )}
        />
      </DataTable>
    </List>
  );
};
