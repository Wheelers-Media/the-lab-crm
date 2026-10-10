export type QuoteCheckoutMode = "parts" | "all";

export type QuoteCheckoutResult = {
  url: string;
  dueNow: number;
  dueAtPickup: number;
  emailed: boolean;
};

/** A checkout link failure; code "not_connected" means Shopify is not set up yet. */
export class QuoteCheckoutError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "QuoteCheckoutError";
    this.code = code;
  }
}
