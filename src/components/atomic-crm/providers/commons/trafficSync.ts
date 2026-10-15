export type TrafficSyncResult = {
  /** Daily rows copied from Shopify's reports. */
  synced: number;
  /** How many days back the copy reached. */
  days: number;
};

/**
 * A traffic sync failure. Code "not_connected": Shopify is not set up yet.
 * Code "needs_scope": the Shopify app has not been given report access.
 */
export class TrafficSyncError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "TrafficSyncError";
    this.code = code;
  }
}
