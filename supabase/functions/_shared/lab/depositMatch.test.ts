// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  nameKey,
  pickByCustomer,
  sameName,
  type Candidate,
} from "./depositMatch";

const booking = (
  id: number,
  contactId: number | null,
  name: string,
  when: string,
): Candidate => ({ id, contactId, name, when });

describe("sameName", () => {
  it("ignores capitals, accents, spacing and middle names", () => {
    expect(sameName("jose  o'neil", "José O'Neil")).toBe(true);
    expect(sameName("Mary Jo Smith", "mary smith")).toBe(true);
  });

  it("does not match a lone first name or different last names", () => {
    expect(sameName("Sam", "Sam Doe")).toBe(false);
    expect(sameName("Sam Doe", "Sam Dole")).toBe(false);
  });
});

describe("nameKey", () => {
  it("joins first and last names and skips empty parts", () => {
    expect(nameKey("Sam", undefined, " DOE ")).toBe("sam doe");
  });
});

describe("pickByCustomer", () => {
  const bookings = [
    booking(1, 10, "Sam Doe", "2026-10-20T15:00:00Z"),
    booking(2, 10, "Sam Doe", "2026-10-14T15:00:00Z"),
    booking(3, 11, "Alex Rowe", "2026-10-13T15:00:00Z"),
  ];

  it("takes the customer's soonest booking when the payer is on file", () => {
    const result = pickByCustomer(bookings, {
      contactId: 10,
      name: "Someone Else",
    });
    expect(result).toMatchObject({ kind: "match", by: "customer" });
    expect(result.kind === "match" && result.item.id).toBe(2);
  });

  it("finds the booking by name when the payer used a different email or phone", () => {
    const result = pickByCustomer(bookings, {
      contactId: 99,
      name: "alex rowe",
    });
    expect(result).toMatchObject({ kind: "match", by: "name" });
    expect(result.kind === "match" && result.item.id).toBe(3);
  });

  it("leaves it to a person when two different customers share the name", () => {
    const twins = [
      booking(1, 10, "Sam Doe", "2026-10-14T15:00:00Z"),
      booking(2, 12, "Sam Doe", "2026-10-15T15:00:00Z"),
    ];
    const result = pickByCustomer(twins, { contactId: null, name: "Sam Doe" });
    expect(result.kind).toBe("ambiguous");
  });

  it("finds nothing when no booking carries the name", () => {
    expect(
      pickByCustomer(bookings, { contactId: null, name: "Pat Lee" }).kind,
    ).toBe("none");
    expect(pickByCustomer(bookings, { contactId: null, name: "" }).kind).toBe(
      "none",
    );
  });

  it("prefers the customer record over a same-name booking of someone else", () => {
    const mixed = [
      booking(1, 12, "Sam Doe", "2026-10-13T15:00:00Z"),
      booking(2, 10, "Sam Doe", "2026-10-18T15:00:00Z"),
    ];
    const result = pickByCustomer(mixed, { contactId: 10, name: "Sam Doe" });
    expect(result.kind === "match" && result.item.id).toBe(2);
  });
});
