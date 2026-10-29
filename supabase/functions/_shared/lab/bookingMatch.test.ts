// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  nameTokens,
  type NamedBooking,
  personFromTitle,
  pickBookingForCustomer,
  titleNames,
} from "./bookingMatch";

const booking = (
  id: number,
  contactId: number | null,
  title: string,
  when = "2026-10-27T15:00:00Z",
): NamedBooking => ({ id, contactId, title, when });

describe("nameTokens", () => {
  it("drops accents, punctuation and capitals", () => {
    expect(nameTokens("  José   O'Neil ")).toEqual(["jose", "oneil"]);
  });

  it("treats a possessive as the plain name", () => {
    expect(nameTokens("Cory Langdon's truck")).toEqual([
      "cory",
      "langdon",
      "truck",
    ]);
  });
});

describe("titleNames", () => {
  it("finds the name at the start of a title with the job after it", () => {
    expect(titleNames("Cory Langdon — ceramic coating", "Cory Langdon")).toBe(
      true,
    );
  });

  it("ignores capitals, spacing and accents", () => {
    expect(titleNames("CORY  LANGDON", "cory langdon")).toBe(true);
    expect(titleNames("Jose O'Neil drop off", "José O'Neil")).toBe(true);
  });

  it("accepts the name written last name first", () => {
    expect(titleNames("Langdon, Cory", "Cory Langdon")).toBe(true);
  });

  it("matches a last name of several words, and skips one on the record", () => {
    expect(titleNames("Cory Van Der Berg", "Cory Van Der Berg")).toBe(true);
    expect(titleNames("Cory Van Der Berg — ceramic", "Cory Van Der Berg")).toBe(
      true,
    );
    // First and last are the identity, as with deposits (a middle name is optional)
    expect(titleNames("Cory Berg drop off", "Cory Van Der Berg")).toBe(true);
  });

  it("never matches one word on its own", () => {
    expect(titleNames("Cory", "Cory")).toBe(false);
    expect(titleNames("Cory Langdon", "Cory")).toBe(false);
  });

  it("does not match a different person or an unrelated title", () => {
    expect(titleNames("Cory Langdon", "Cory Langdon-Smith")).toBe(false);
    expect(titleNames("Cory Doe", "Cory Langdon")).toBe(false);
    expect(titleNames("Ceramic coating", "Cory Langdon")).toBe(false);
  });
});

describe("pickBookingForCustomer", () => {
  it("takes the booking that names the payer", () => {
    const result = pickBookingForCustomer(
      [booking(1, null, "Dana Smith"), booking(2, null, "Cory Langdon")],
      { name: "Cory Langdon" },
    );
    expect(result.kind === "match" && result.booking.id).toBe(2);
  });

  it("prefers the payer's own booking when they already have one", () => {
    const result = pickBookingForCustomer(
      [
        booking(1, 11, "Cory Langdon", "2026-10-27T15:00:00Z"),
        booking(2, 10, "Cory Langdon", "2026-10-27T19:00:00Z"),
      ],
      { name: "Cory Langdon", contactId: 10 },
    );
    expect(result.kind === "match" && result.booking.id).toBe(2);
  });

  it("picks the earliest of one customer's jobs on the day", () => {
    const result = pickBookingForCustomer(
      [
        booking(1, 10, "Cory Langdon", "2026-10-27T19:00:00Z"),
        booking(2, 10, "Cory Langdon", "2026-10-27T15:00:00Z"),
      ],
      { name: "Cory Langdon", contactId: 10 },
    );
    expect(result.kind === "match" && result.booking.id).toBe(2);
  });

  it("leaves two booked-under-one-name jobs to a person", () => {
    const result = pickBookingForCustomer(
      [booking(1, null, "Cory Langdon"), booking(2, null, "Cory Langdon")],
      { name: "Cory Langdon" },
    );
    expect(result.kind).toBe("ambiguous");
  });

  it("finds nothing when no booking names the payer", () => {
    expect(
      pickBookingForCustomer([booking(1, null, "Dana Smith")], {
        name: "Cory Langdon",
      }).kind,
    ).toBe("none");
    expect(pickBookingForCustomer([], { name: "Cory Langdon" }).kind).toBe(
      "none",
    );
  });
});

describe("personFromTitle", () => {
  it.each([
    ["Kristie Mayer", "Kristie", "Mayer"],
    ["John Hartman delete", "John", "Hartman"],
    ["Noah bumstead maintaince x2", "Noah", "Bumstead"],
    ["Chris Burke PPF", "Chris", "Burke"],
    ["Clayton Carlson tint", "Clayton", "Carlson"],
    ["Tristen Yanota - Detailing Bay Drop-off | THE LAB", "Tristen", "Yanota"],
    ["Aron artech painting", "Aron", "Artech"],
    ["Prashant nair", "Prashant", "Nair"],
  ])("reads %s as a person", (title, firstName, lastName) => {
    expect(personFromTitle(title)).toEqual({ firstName, lastName });
  });

  it("gives a first name only when the title has one word before the job", () => {
    expect(personFromTitle("Dolly maintenance")).toEqual({
      firstName: "Dolly",
      lastName: "",
    });
    expect(personFromTitle("Josh with ts solutions")).toEqual({
      firstName: "Josh",
      lastName: "",
    });
  });

  it("finds no person when the title starts with the vehicle or the job", () => {
    expect(personFromTitle("Dodge detail")).toBeNull();
    expect(personFromTitle("Tint 2019 F-150")).toBeNull();
    expect(personFromTitle("2023 ram 2500")).toBeNull();
  });
});
