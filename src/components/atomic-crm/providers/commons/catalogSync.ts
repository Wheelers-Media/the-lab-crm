export type CatalogSyncResult = {
  synced: number;
  /** False when the Shopify app may not read what the shop pays for items. */
  costAvailable: boolean;
  /** Products with a known cost. */
  withCost: number;
};

/** A catalog sync failure; code "not_connected" means Shopify is not set up yet. */
export class CatalogSyncError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "CatalogSyncError";
    this.code = code;
  }
}
