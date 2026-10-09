import { describe, expect, it } from "vitest";
import {
  categoryFor,
  isAllowedOrigin,
  normalizeEmail,
  normalizePhone,
  parseMoney,
  phoneFormats,
} from "./lab.ts";

describe("lab helpers", () => {
  it("normalizes North American phone numbers", () => {
    expect(normalizePhone("(250) 261-9502")).toBe("+12502619502");
    expect(normalizePhone("1-250-261-9502")).toBe("+12502619502");
    expect(normalizePhone("12345")).toBeNull();
  });

  it("lists the formats a stored number may use", () => {
    const f = phoneFormats("+12502619502");
    expect(f).toContain("(250) 261-9502");
    expect(f).toContain("250-261-9502");
    expect(f).toContain("+12502619502");
  });

  it("accepts real emails only", () => {
    expect(normalizeEmail(" A@B.CA ")).toBe("a@b.ca");
    expect(normalizeEmail("not an email")).toBeNull();
    expect(normalizeEmail("<x@y.com>")).toBeNull();
  });

  it("reads whole dollars from price text", () => {
    expect(parseMoney("$1,260 CAD")).toBe(1260);
    expect(parseMoney("from $300")).toBe(300);
    expect(parseMoney("n/a")).toBeNull();
  });

  it("maps services to deal categories", () => {
    expect(categoryFor("Window Tinting")).toBe("window-tint");
    expect(categoryFor("SxS tint")).toBe("sxs-tint");
    expect(categoryFor("Premium Detailing")).toBe("detailing");
    expect(categoryFor("Custom Tuning, EGR Solutions")).toBe("tuning");
    expect(categoryFor("EGR Solutions")).toBe("diesel-parts");
    expect(categoryFor("Other / Custom Install")).toBe("install");
  });

  it("allows the live site, its previews and localhost only", () => {
    expect(isAllowedOrigin("https://thelabfsj.ca")).toBe(true);
    expect(
      isAllowedOrigin(
        "https://the-lab-git-design-polish-nathans-projects-e8dc0632.vercel.app",
      ),
    ).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
    expect(isAllowedOrigin(null)).toBe(false);
  });
});
