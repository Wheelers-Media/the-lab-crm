import { Link } from "react-router";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

import { contactName, money } from "../operations/format";
import {
  formatShopDay,
  formatShopTime,
  shopDayKey,
} from "../operations/shopTime";
import type { Order } from "../types";
import { channelName, netOf } from "./salesModel";
import { useCustomerNames } from "./useNumbersData";

/** The orders behind a number, shown in a sheet over the Numbers screen. */
export interface Drill {
  title: string;
  hint?: string;
  orders: Order[];
}

const statusOf = (o: Order): string =>
  o.cancelled_at
    ? "Cancelled"
    : o.financial_status
      ? `${o.financial_status.charAt(0).toUpperCase()}${o.financial_status.slice(1).replace(/_/g, " ")}`
      : "";

export const OrderDrillSheet = ({
  drill,
  onClose,
}: {
  drill: Drill | null;
  onClose: () => void;
}) => {
  const isMobile = useIsMobile();
  const orders = drill?.orders ?? [];
  const names = useCustomerNames(
    orders
      .map((o) => o.contact_id)
      .filter((id): id is NonNullable<Order["contact_id"]> => id != null),
  );
  const net = orders.reduce((sum, o) => sum + netOf(o), 0);

  return (
    <Sheet open={drill != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "max-h-[85dvh] overflow-y-auto"
            : "w-full overflow-y-auto sm:max-w-md"
        }
      >
        <SheetHeader>
          <SheetTitle>{drill?.title}</SheetTitle>
          <SheetDescription>
            {orders.length} {orders.length === 1 ? "order" : "orders"},{" "}
            {money(net)} net sales
            {drill?.hint ? `. ${drill.hint}` : ""}
          </SheetDescription>
        </SheetHeader>
        {orders.length ? (
          <ul className="divide-y divide-border px-4 pb-6">
            {orders.map((o) => {
              const contact =
                o.contact_id != null ? names.get(o.contact_id) : null;
              const status = statusOf(o);
              return (
                <li
                  key={o.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium lab-num">
                      {o.order_number}
                      {o.is_deposit ? (
                        <span className="lab-chip lab-chip-muted ml-2">
                          Deposit
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatShopDay(shopDayKey(o.ordered_at), {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                      , {formatShopTime(o.ordered_at)} · {channelName(o)}
                    </p>
                    <p className="text-sm truncate">
                      {o.contact_id != null && contact ? (
                        <Link
                          to={`/contacts/${o.contact_id}/show`}
                          className="underline-offset-4 hover:underline"
                        >
                          {contactName(contact)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          {o.contact_id != null ? "Customer" : "In-shop sale"}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium lab-num">{money(netOf(o))}</p>
                    {status ? (
                      <p className="text-xs text-muted-foreground">{status}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 pb-6 text-sm text-muted-foreground">
            No orders here.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
};
