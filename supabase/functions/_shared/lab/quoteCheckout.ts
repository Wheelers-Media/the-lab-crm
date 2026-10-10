// Turns a CRM quote (the job's package lines) into a Shopify draft order, so
// the customer pays through a Shopify checkout link under their own name.
// "parts": the parts are paid now and the labour at pickup.
// "all": everything is paid now.

export type QuoteLine = {
  package_id?: number | string | null;
  title: string;
  price: number;
  quantity: number;
  variant_id?: string | null;
  kind?: "part" | "labour";
};

export type PayMode = "parts" | "all";

const kindOf = (line: QuoteLine) =>
  line.kind ?? (line.variant_id ? "part" : "labour");

const money = (amount: number) => ({
  amount: (Math.round(amount * 100) / 100).toFixed(2),
  currencyCode: "CAD",
});

const cad = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

export type DraftOrderPlan = {
  lineItems: Array<Record<string, unknown>>;
  /** What the link charges, before tax and shipping. */
  dueNow: number;
  /** Labour left to pay at pickup when only the parts are paid now. */
  dueAtPickup: number;
};

/** The draft order lines for a quote, or an error a person can act on. */
export const draftOrderPlan = (
  rawLines: unknown,
  mode: PayMode,
): DraftOrderPlan | { error: string } => {
  const lines = (Array.isArray(rawLines) ? rawLines : []).filter(
    (l): l is QuoteLine =>
      l != null &&
      typeof l === "object" &&
      typeof (l as QuoteLine).title === "string" &&
      Number((l as QuoteLine).quantity) > 0,
  );
  if (!lines.length) return { error: "The quote has no lines yet." };

  const parts = lines.filter((l) => kindOf(l) === "part");
  const labour = lines.filter((l) => kindOf(l) === "labour");
  const charged = mode === "parts" ? parts : lines;
  if (!charged.length) {
    return {
      error:
        "There are no parts on this quote. Choose to have everything paid now instead.",
    };
  }

  const total = (ls: QuoteLine[]) =>
    ls.reduce((s, l) => s + (Number(l.price) || 0) * Number(l.quantity), 0);

  const lineItems = charged.map((line) => {
    const quantity = Math.max(1, Math.round(Number(line.quantity)));
    const price = money(Math.max(0, Number(line.price) || 0));
    // A catalog part sells the real Shopify variant, at the quoted price
    if (line.variant_id) {
      return {
        variantId: `gid://shopify/ProductVariant/${String(line.variant_id).replace(/\D/g, "")}`,
        quantity,
        priceOverride: price,
      };
    }
    return {
      title: line.title,
      quantity,
      originalUnitPriceWithCurrency: price,
      requiresShipping: false,
      taxable: true,
    };
  });

  return {
    lineItems,
    dueNow: Math.round(total(charged) * 100) / 100,
    dueAtPickup: mode === "parts" ? Math.round(total(labour) * 100) / 100 : 0,
  };
};

/** The note Eric and the customer see on the order. */
export const draftOrderNote = (
  dealName: string,
  plan: DraftOrderPlan,
): string =>
  plan.dueAtPickup > 0
    ? `${dealName}. Parts paid now. Labour of ${cad(plan.dueAtPickup)} plus tax is paid at pickup.`
    : `${dealName}. Paid in full.`;
