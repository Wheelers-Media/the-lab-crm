import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  QUERY_CACHE_KEY,
  dropOversizedQueryCache,
  queryCacheStorage,
  shouldPersistQuery,
} from "./queryCachePersistence";

const rows = (count: number) =>
  Array.from({ length: count }, (_, id) => ({ id, notes: "x".repeat(200) }));

const savedQuery = (queryKey: unknown[], data: unknown) => {
  const client = new QueryClient();
  client.setQueryData(queryKey, data);
  const query = client.getQueryCache().find({ queryKey });
  if (!query) throw new Error("query was not stored");
  return query;
};

/** Takes up every free character of localStorage, as a nearly full phone does. */
const fillStorage = () => {
  let chunk = 1 << 20;
  let n = 0;
  while (chunk >= 1) {
    try {
      localStorage.setItem(`filler-${n++}`, "x".repeat(chunk));
    } catch {
      chunk >>= 1;
    }
  }
};

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("shouldPersistQuery", () => {
  it("keeps a short list so the next launch starts with data", () => {
    const query = savedQuery(["deals", "getList", {}], {
      data: rows(20),
      total: 20,
    });

    expect(shouldPersistQuery(query)).toBe(true);
  });

  it("leaves out the Numbers downloads, which are quick to fetch again", () => {
    const query = savedQuery(["numbers", "orders", {}], rows(5));

    expect(shouldPersistQuery(query)).toBe(false);
  });

  it("leaves out a long list that would fill the phone", () => {
    const query = savedQuery(["orders", "getList", {}], {
      data: rows(820),
      total: 820,
    });

    expect(shouldPersistQuery(query)).toBe(false);
  });
});

describe("queryCacheStorage", () => {
  it("saves a cache of a sensible size", () => {
    queryCacheStorage.setItem(QUERY_CACHE_KEY, "x".repeat(1000));

    expect(localStorage.getItem(QUERY_CACHE_KEY)).toHaveLength(1000);
  });

  it("drops a cache that is too big, old copy included, instead of keeping it", () => {
    localStorage.setItem(QUERY_CACHE_KEY, "old");

    queryCacheStorage.setItem(QUERY_CACHE_KEY, "x".repeat(3_000_000));

    expect(localStorage.getItem(QUERY_CACHE_KEY)).toBeNull();
  });

  it("does not throw when the phone has no room left, and frees the old copy", () => {
    localStorage.setItem(QUERY_CACHE_KEY, "x".repeat(10));
    fillStorage();

    expect(() =>
      queryCacheStorage.setItem(QUERY_CACHE_KEY, "x".repeat(500_000)),
    ).not.toThrow();
    expect(localStorage.getItem(QUERY_CACHE_KEY)).toBeNull();
  });
});

describe("dropOversizedQueryCache", () => {
  it("clears a cache saved by an earlier version so sign-in has room again", () => {
    localStorage.setItem(QUERY_CACHE_KEY, "x".repeat(3_000_000));
    localStorage.setItem("sb-session", "kept");

    dropOversizedQueryCache();

    expect(localStorage.getItem(QUERY_CACHE_KEY)).toBeNull();
    expect(localStorage.getItem("sb-session")).toBe("kept");
  });

  it("leaves a cache of a sensible size alone", () => {
    localStorage.setItem(QUERY_CACHE_KEY, "x".repeat(5000));

    dropOversizedQueryCache();

    expect(localStorage.getItem(QUERY_CACHE_KEY)).toHaveLength(5000);
  });
});
