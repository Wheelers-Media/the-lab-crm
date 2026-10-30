/** Where the persister keeps the saved query cache (its default key). */
export const QUERY_CACHE_KEY = "REACT_QUERY_OFFLINE_CACHE";

// A browser gives a site about 5 MB of localStorage, and the sign-in needs
// room in it too. The saved cache is only a head start for the next launch,
// so it stays far below that.
const MAX_SAVED_CHARS = 2_000_000;
const MAX_QUERY_CHARS = 100_000;

/** The part of a query the choice depends on, whichever copy of the library made it. */
interface SavedQuery {
  queryKey: readonly unknown[];
  state: { status: string; data: unknown };
}

/**
 * Whole-table downloads (the Numbers screen, long lists) are quick to fetch
 * again and far too big to keep on the phone: each saved query stays small.
 */
export const shouldPersistQuery = (query: SavedQuery): boolean => {
  if (query.state.status !== "success") return false;
  if (query.queryKey[0] === "numbers") return false;
  return JSON.stringify(query.state.data ?? null).length <= MAX_QUERY_CHARS;
};

/**
 * localStorage for the saved cache that never throws and never hogs it: a
 * cache that is too big, or that does not fit, is dropped so the sign-in
 * keeps its room.
 */
export const queryCacheStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (value.length <= MAX_SAVED_CHARS) {
        localStorage.setItem(key, value);
        return;
      }
    } catch {
      // storage is full or blocked: fall through and free the old copy
    }
    queryCacheStorage.removeItem(key);
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      // storage is blocked: nothing was saved either
    }
  },
};

/**
 * Versions before this one saved far more (megabytes, up to the whole quota).
 * A phone that already holds such a copy is cleared before the app starts.
 */
export const dropOversizedQueryCache = (): void => {
  if (
    (queryCacheStorage.getItem(QUERY_CACHE_KEY)?.length ?? 0) > MAX_SAVED_CHARS
  )
    queryCacheStorage.removeItem(QUERY_CACHE_KEY);
};
