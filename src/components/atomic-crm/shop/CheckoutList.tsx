import { useTranslate } from "ra-core";
import { ExternalLink } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { DateField } from "@/components/admin/date-field";
import { List } from "@/components/admin/list";
import { QuickFilter } from "./QuickFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { TopToolbar } from "../layout/TopToolbar";
import type { ShopifyCheckout } from "../types";
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

const RecoveryLink = ({ url }: { url: string | null }) => {
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

/** Checkouts the customer started but never paid for. */
export const CheckoutList = () => {
  const translate = useTranslate();
  return (
    <List
      actions={<CheckoutListActions />}
      filter={{ "completed_at@is": null }}
      sort={{ field: "checkout_updated_at", order: "DESC" }}
      perPage={50}
    >
      <DataTable<ShopifyCheckout> bulkActionButtons={false} rowClick={false}>
        <DataTable.Col<ShopifyCheckout>
          source="checkout_updated_at"
          label="resources.shopify_checkouts.fields.checkout_updated_at"
        >
          <DateField source="checkout_updated_at" showTime />
        </DataTable.Col>
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
          render={(c) => <RecoveryLink url={c.recovery_url} />}
        />
      </DataTable>
    </List>
  );
};
