import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: async () => ({ data: [{ is_initialized: 1 }] }),
    }),
  }),
}));

import { getIsInitialized } from "./authProvider";

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("getIsInitialized", () => {
  it("answers from the database and remembers the answer for the next launch", async () => {
    const answer = await getIsInitialized();

    expect(answer).toBe(true);
    expect(localStorage.getItem("RaStore.auth.is_initialized")).toBe("true");
  });

  it("still answers on a phone whose storage is full, instead of failing the sign-in", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException(
        "The quota has been exceeded.",
        "QuotaExceededError",
      );
    });

    const answer = await getIsInitialized();

    expect(answer).toBe(true);
  });
});
