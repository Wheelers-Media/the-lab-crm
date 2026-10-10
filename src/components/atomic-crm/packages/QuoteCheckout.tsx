import { Check, Copy, Link2, Mail } from "lucide-react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";

import {
  QuoteCheckoutError,
  type QuoteCheckoutMode,
} from "../providers/commons/quoteCheckout";
import type { CrmDataProvider } from "../providers/types";
import type { Deal } from "../types";

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * Sends the customer a Shopify checkout link for the saved quote:
 * parts now and labour at pickup, or everything now.
 */
export const QuoteCheckout = ({
  deal,
  totals,
  isDirty,
  onSave,
}: {
  deal: Deal;
  totals: { parts: number; labour: number; total: number };
  isDirty: boolean;
  /** Saves the quote first, so the link charges what is on screen. */
  onSave: () => Promise<void>;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [mode, setMode] = useState<QuoteCheckoutMode>(
    totals.parts > 0 ? "parts" : "all",
  );
  const [busy, setBusy] = useState<"email" | "link" | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const checkout = deal.checkout;

  const options: Array<{
    value: QuoteCheckoutMode;
    title: string;
    detail: string;
    disabled: boolean;
  }> = [
    {
      value: "parts",
      title: "Parts now, labour at pickup",
      detail: `${money(totals.parts)} now · ${money(totals.labour)} at pickup`,
      disabled: totals.parts <= 0,
    },
    {
      value: "all",
      title: "Everything now",
      detail: `${money(totals.total)} now`,
      disabled: totals.total <= 0,
    },
  ];

  const send = async (email: boolean) => {
    setBusy(email ? "email" : "link");
    try {
      if (isDirty) await onSave();
      const result = await dataProvider.createQuoteCheckout(
        deal.id,
        mode,
        email,
      );
      notify(
        result.emailed
          ? "Checkout link emailed to the customer"
          : "Checkout link created",
        { type: "success" },
      );
      refresh();
    } catch (error) {
      if (error instanceof QuoteCheckoutError && error.code === "not_connected")
        setNotConnected(true);
      else
        notify(
          error instanceof Error ? error.message : "Could not create the link.",
          {
            type: "error",
          },
        );
    } finally {
      setBusy(null);
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify("Select the link and copy it", { type: "info" });
    }
  };

  return (
    <section
      className="flex flex-col gap-3"
      aria-labelledby="quote-checkout-title"
    >
      <h2 id="quote-checkout-title" className="text-base font-semibold">
        Send a checkout link
      </h2>
      <div
        role="radiogroup"
        aria-label="How the customer pays"
        className="grid gap-2"
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={mode === o.value}
            disabled={o.disabled}
            onClick={() => setMode(o.value)}
            className={`flex flex-col items-start rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
              mode === o.value
                ? "border-foreground bg-foreground/5"
                : "border-border hover:border-foreground/40"
            }`}
          >
            <span className="text-sm font-medium">{o.title}</span>
            <span className="text-xs text-muted-foreground lab-num">
              {o.detail}
            </span>
          </button>
        ))}
      </div>
      {notConnected ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          Checkout links need the CRM connected to Shopify. Once the Shopify
          access key is added, this button sends a secure link under the
          customer's name.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          onClick={() => send(true)}
          disabled={busy != null || totals.total <= 0}
        >
          <Mail className="size-4" />
          {busy === "email" ? "Sending..." : "Email link"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => send(false)}
          disabled={busy != null || totals.total <= 0}
        >
          <Link2 className="size-4" />
          {busy === "link" ? "Creating..." : "Create link"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Taxes are added at checkout. The customer pays in Shopify and the order
        shows up under their name.
      </p>
      {checkout ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">
            {checkout.emailed ? "Emailed" : "Created"}{" "}
            {when(checkout.created_at)} · {checkout.draft_order_name} ·{" "}
            {money(checkout.due_now)} now
            {checkout.due_at_pickup > 0
              ? `, ${money(checkout.due_at_pickup)} at pickup`
              : ""}
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={checkout.url}
              aria-label="Checkout link"
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copy(checkout.url)}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
};
