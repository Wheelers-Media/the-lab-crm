import { useTranslate } from "ra-core";
import { DataTable } from "@/components/admin/data-table";
import { DateField } from "@/components/admin/date-field";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { QuickFilter } from "./QuickFilter";
import { Badge } from "@/components/ui/badge";

import { TopToolbar } from "../layout/TopToolbar";
import type { Order } from "../types";
import { ContactLink } from "./ContactLink";
import {
  formatMoney,
  orderNet,
  orderStatusLabel,
  summarizeLines,
} from "./shopFormat";

const OrderListActions = () => {
  const translate = useTranslate();
  return (
    <TopToolbar>
      <QuickFilter
        label={translate("resources.orders.filters.deposits", {
          _: "Deposits only",
        })}
        value={{ is_deposit: true }}
      />
      <QuickFilter
        label={translate("resources.orders.filters.no_contact", {
          _: "Not linked to a contact",
        })}
        value={{ "contact_id@is": null }}
      />
      <ExportButton />
    </TopToolbar>
  );
};

export const CategoryBadges = ({
  categories,
}: {
  categories: string[] | null | undefined;
}) => (
  <div className="flex flex-wrap gap-1">
    {(categories ?? []).map((c) => (
      <Badge key={c} variant="outline" className="font-normal">
        {c}
      </Badge>
    ))}
  </div>
);

export const OrderList = () => (
  <List
    actions={<OrderListActions />}
    sort={{ field: "ordered_at", order: "DESC" }}
    perPage={50}
  >
    <DataTable<Order> bulkActionButtons={false} rowClick={false}>
      <DataTable.Col<Order>
        source="ordered_at"
        label="resources.orders.fields.ordered_at"
      >
        <DateField source="ordered_at" />
      </DataTable.Col>
      <DataTable.Col<Order>
        source="order_number"
        label="resources.orders.fields.order_number"
      />
      <DataTable.Col<Order>
        source="contact_id"
        label="resources.orders.fields.contact_id"
        disableSort
      >
        <ContactLink />
      </DataTable.Col>
      <DataTable.Col<Order>
        label="resources.orders.fields.line_items"
        disableSort
        render={(o) => (
          <div className="flex flex-col gap-1 max-w-md">
            <CategoryBadges categories={o.categories} />
            <span className="text-xs text-muted-foreground truncate">
              {summarizeLines(o.line_items)}
            </span>
          </div>
        )}
      />
      <DataTable.Col<Order>
        source="total"
        label="resources.orders.fields.total"
        headerClassName="text-right"
        cellClassName="text-right tabular-nums"
        render={(o) => formatMoney(orderNet(o), o.currency)}
      />
      <DataTable.Col<Order>
        source="financial_status"
        label="resources.orders.fields.financial_status"
        render={(o) => orderStatusLabel(o)}
      />
    </DataTable>
  </List>
);
