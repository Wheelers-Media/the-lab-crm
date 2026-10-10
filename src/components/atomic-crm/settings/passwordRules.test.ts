import { describe, expect, it } from "vitest";

import { passwordProblem } from "./passwordRules";

describe("passwordProblem", () => {
  it("asks for at least 8 characters", () => {
    expect(passwordProblem("short", "short")).toBe(
      "Use at least 8 characters.",
    );
  });

  it("catches a mistyped second entry", () => {
    expect(passwordProblem("longenough1", "longenough2")).toBe(
      "The two passwords don't match.",
    );
  });

  it("accepts a long password typed twice", () => {
    expect(passwordProblem("longenough1", "longenough1")).toBeNull();
  });
});
