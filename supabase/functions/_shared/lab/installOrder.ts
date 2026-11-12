// Orders from the website's power package builder that ship to the shop to be
// installed. The builder tags the cart with a Fulfilment attribute; the CRM
// opens a job in "Parts on the way" for them and later prompts the customer to
// pick an install day, once the parts have arrived.
import type { ShopifyOrder } from "./parse.ts";

/** Must match the Fulfilment value the builder on thelabfsj.ca sends. */
export const INSTALL_FULFILMENT = "Ship to THE LAB, install at THE LAB";

/** Where customers pick their install day (everything except detailing). */
export const INSTALL_BOOKING_LINK = "https://cal.com/the-lab/eric-services";

export type InstallJob = {
  /** "Power package: 2023-2026 Powerstroke" */
  name: string;
  build: string;
  vin: string;
  phone: string;
  description: string;
};

/** The job to track for this order, or null when it is not an install order. */
export const installJobFrom = (order: ShopifyOrder): InstallJob | null => {
  const a = order.attributes;
  if (a.Fulfilment !== INSTALL_FULFILMENT) return null;
  if (order.isDeposit) return null;
  const build = (a.Build ?? "").trim();
  const vin = (a.VIN ?? "").trim().toUpperCase();
  const parts = order.lineItems.map(
    (l) => `${l.quantity > 1 ? `${l.quantity} x ` : ""}${l.name}`,
  );
  const description = [
    build && `Build: ${build}`,
    vin && `VIN: ${vin}`,
    `Parts paid on Shopify order ${order.orderNumber}, shipping to the shop:`,
    ...parts.map((p) => `- ${p}`),
  ]
    .filter(Boolean)
    .join("\n");
  return {
    name: build ? `Install: ${build}` : "Install: parts order",
    build,
    vin,
    phone: (a.Phone ?? "").trim(),
    description,
  };
};
