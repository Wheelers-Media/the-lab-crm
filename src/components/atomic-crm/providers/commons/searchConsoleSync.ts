export type SearchConsoleSyncResult = {
  /** The Search Console property read, e.g. "sc-domain:thelabfsj.ca". */
  site: string;
  /** Days, search phrase rows and page rows copied this time. */
  days: number;
  queries: number;
  pages: number;
};

/**
 * A Google search sync failure. Codes: "not_configured" (no Google service
 * account), "needs_access" (Search Console has not shared the site with it;
 * `email` is the address to add), "api_disabled" (the Search Console API is
 * off in the Google project).
 */
export class SearchConsoleSyncError extends Error {
  code?: string;
  email?: string;
  constructor(message: string, code?: string, email?: string) {
    super(message);
    this.name = "SearchConsoleSyncError";
    this.code = code;
    this.email = email;
  }
}
