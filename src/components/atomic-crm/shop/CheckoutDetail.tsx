import { Copy, ExternalLink, Mail, MessageSquare, Phone } from "lucide-react";
import { RecordContextProvider, useGetList, useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { dial } from "../contacts/reach";
import { smsHref } from "../shopfloor/messageTemplates";
import type { Order, ShopifyCheckout } from "../types";
import {
  agoLabel,
  cartHeat,
  HEAT_LABEL,
  lineTotal,
  reachOf,
  recoveryText,
} from "./cartModel";
import { ContactLink } from "./ContactLink";
import { customerSpend, formatMoney } from "./shopFormat";

const HEAT_CHIP = {
  hot: "lab-chip-danger",
  warm: "lab-chip-warn",
  cold: "lab-chip-muted",
} as const;

const PastOrders = ({
  contactId,
}: {
  contactId: ShopifyCheckout["contact_id"];
}) => {
  const { data = [], isPending } = useGetList<Order>(
    "orders",
    {
      filter: { contact_id: contactId },
      sort: { field: "ordered_at", order: "DESC" },
      pagination: { page: 1, perPage: 100 },
    },
    { enabled: contactId != null },
  );
  if (contactId == null) {
    return (
      <p className="text-sm text-muted-foreground">
        Not linked to a customer yet, so there is no order history.
      </p>
    );
  }
  if (isPending) return null;
  const spend = customerSpend(data);
  return spend.orderCount ? (
    <p className="text-sm">
      Existing customer: {spend.orderCount} order
      {spend.orderCount === 1 ? "" : "s"}, {formatMoney(spend.lifetime)} spent.
    </p>
  ) : (
    <p className="text-sm text-muted-foreground">
      New to the shop: no paid orders yet.
    </p>
  );
};

/**
 * One abandoned cart in full: what was in it, who left it, how long ago, what
 * they have bought before, and the one-tap ways to win it back (call, a text
 * already written, email, their saved cart).
 */
export const CheckoutDetail = ({
  checkout,
  onClose,
}: {
  checkout: ShopifyCheckout | null;
  onClose: () => void;
}) => {
  const notify = useNotify();
  if (!checkout) return null;
  const { phone, email } = reachOf(checkout);
  const heat = cartHeat(checkout);
  const text = recoveryText(checkout);
  const recovery =
    checkout.recovery_url && /^https:\/\//i.test(checkout.recovery_url)
      ? checkout.recovery_url
      : null;
  const copy = (value: string, what: string) =>
    navigator.clipboard
      ?.writeText(value)
      .then(() => notify(`${what} copied`, { type: "info" }))
      .catch(() => notify("Could not copy", { type: "warning" }));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {checkout.customer_name || email || phone || "Abandoned cart"}
            <span className={`lab-chip ${HEAT_CHIP[heat]}`}>
              {HEAT_LABEL[heat]}
            </span>
          </DialogTitle>
          <DialogDescription>
            Left {agoLabel(checkout.checkout_updated_at)} ·{" "}
            {formatMoney(checkout.total)}
            {checkout.task_id != null ? " · call task added" : ""}
          </DialogDescription>
        </DialogHeader>

        <section aria-label="In the cart" className="flex flex-col gap-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
            In the cart
          </h3>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {(checkout.line_items ?? []).map((line, i) => (
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
                  {formatMoney(lineTotal(line))}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Customer" className="flex flex-col gap-1">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
            Customer
          </h3>
          <RecordContextProvider value={checkout}>
            <ContactLink
              fallback={
                checkout.customer_name || checkout.email || checkout.phone
              }
            />
          </RecordContextProvider>
          <p className="text-sm text-muted-foreground">
            {[phone, email].filter(Boolean).join(" · ") ||
              "No phone or email was left, so this one can't be followed up."}
          </p>
          <PastOrders contactId={checkout.contact_id} />
        </section>

        <section aria-label="Win it back" className="flex flex-col gap-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
            Win it back
          </h3>
          <p className="whitespace-pre-line rounded-md bg-muted/60 p-3 text-sm leading-relaxed text-muted-foreground">
            {text}
          </p>
          <div className="flex flex-wrap gap-2">
            {phone ? (
              <>
                <Button asChild size="sm">
                  <a href={smsHref(phone, text)}>
                    <MessageSquare className="size-4" aria-hidden />
                    Text this
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`tel:${dial(phone)}`}>
                    <Phone className="size-4" aria-hidden />
                    Call
                  </a>
                </Button>
              </>
            ) : null}
            {email ? (
              <Button asChild size="sm" variant="outline">
                <a href={`mailto:${email}`}>
                  <Mail className="size-4" aria-hidden />
                  Email
                </a>
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => void copy(text, "Text")}
            >
              <Copy className="size-4" aria-hidden />
              Copy text
            </Button>
            {recovery ? (
              <Button asChild size="sm" variant="outline">
                <a href={recovery} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" aria-hidden />
                  Open cart
                </a>
              </Button>
            ) : null}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
};
