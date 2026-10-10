import { describe, expect, it } from "vitest";

import type { Package } from "../types";
import {
  lineFromPackage,
  linesTotal,
  packagePriceLabel,
  catalogIndex,
  membershipStatus,
  servicesFromOrders,
} from "./packageModel";

describe("packagePriceLabel", () => {
  it("shows one price, a range, or that Eric quotes it", () => {
    expect(packagePriceLabel({ price: 260, price_max: 260 })).toBe("$260");
    expect(packagePriceLabel({ price: 2549, price_max: 3149 })).toBe(
      "$2,549 to $3,149",
    );
    expect(packagePriceLabel({ price: 0, price_max: 0 })).toBe("Eric quotes");
    expect(packagePriceLabel({ price: null, price_max: null })).toBe(
      "Eric quotes",
    );
  });
});

describe("job package lines", () => {
  it("starts a line at the catalog price and adds up quantity", () => {
    const line = lineFromPackage({
      id: 4,
      title: "Ceramic Tint - Front Roll Ups",
      price: 260,
    } as Package);
    expect(line).toEqual({
      package_id: 4,
      title: "Ceramic Tint - Front Roll Ups",
      price: 260,
      quantity: 1,
    });
    expect(
      linesTotal([line, { ...line, title: "Brow", price: 90, quantity: 2 }]),
    ).toBe(440);
    expect(linesTotal(undefined)).toBe(0);
  });
});

describe("servicesFromOrders", () => {
  const order = (
    date: string,
    lines: Array<[string, number, number]>,
    cancelled = false,
  ) => ({
    ordered_at: date,
    cancelled_at: cancelled ? date : null,
    line_items: lines.map(([name, quantity, price]) => ({
      name,
      quantity,
      price,
    })),
  });

  it("groups repeat services, newest first, and skips supplies and deposits", () => {
    const services = servicesFromOrders([
      order("2026-01-10T00:00:00Z", [
        ["Universal Fit - THE LAB - Exterior Wash", 1, 60],
        ["Shop Supplies", 1, 10],
      ]),
      order("2026-05-02T00:00:00Z", [
        ["Universal Fit - THE LAB - Exterior Wash", 1, 60],
        ["$50 Secure Booking Deposit", 1, 50],
        ["The Monthly Signature Membership", 1, 249],
      ]),
      order("2026-06-01T00:00:00Z", [["Ceramic tint", 1, 260]], true),
    ]);
    expect(services).toEqual([
      {
        name: "Exterior Wash",
        times: 2,
        spent: 120,
        lastDate: "2026-05-02T00:00:00Z",
        isMembership: false,
      },
      {
        name: "The Monthly Signature Membership",
        times: 1,
        spent: 249,
        lastDate: "2026-05-02T00:00:00Z",
        isMembership: true,
      },
    ]);
  });
});

describe("catalogIndex", () => {
  const pkg = (
    id: number,
    title: string,
    shopify_title: string,
    status = "active",
  ) => ({ id, title, shopify_title, status }) as Package;

  it("finds the catalog entry for an order line by either name", () => {
    const find = catalogIndex([
      pkg(
        1,
        "Ceramic Tint - Front Roll Ups",
        "Universal Fit - Suntek - Ceramic Tint - Front Roll Ups",
      ),
    ]);
    expect(
      find("Universal Fit - THE LAB - Ceramic Tint - Front Roll Ups")?.id,
    ).toBe(1);
    expect(find("ceramic tint - front roll ups")?.id).toBe(1);
    expect(find("Something else")).toBeUndefined();
  });

  it("prefers a live product over a deleted one with the same name", () => {
    const find = catalogIndex([
      pkg(1, "Exterior Wash", "Exterior Wash", "deleted"),
      pkg(2, "Exterior Wash", "Exterior Wash"),
    ]);
    expect(find("Exterior Wash")?.id).toBe(2);
  });
});

describe("membershipStatus", () => {
  const NOW = new Date("2026-10-09T18:00:00Z");
  const paid = (date: string) => [
    {
      name: "The Monthly Signature Membership",
      times: 1,
      spent: 249,
      lastDate: date,
      isMembership: true,
    },
  ];

  it("uses the membership on the profile first", () => {
    expect(
      membershipStatus(
        { membership: "lab-syndicate", membership_since: "2026-03-01" },
        [],
        NOW,
      ),
    ).toEqual({ active: true, label: "The LAB Syndicate since Mar 2026" });
  });

  it("counts a membership paid in the last 35 days as current", () => {
    expect(membershipStatus({}, paid("2026-09-20T18:00:00Z"), NOW)).toEqual({
      active: true,
      label: "Membership paid Sep 20",
    });
    expect(
      membershipStatus({}, paid("2026-07-01T00:00:00Z"), NOW)?.active,
    ).toBe(false);
  });

  it("shows nothing for customers who never had one", () => {
    expect(membershipStatus({}, [], NOW)).toBeNull();
  });
});
