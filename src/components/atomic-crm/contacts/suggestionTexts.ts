// A ready-to-send text for each profile suggestion. They open the phone's
// Messages app filled in, so nothing goes out until Eric or Christine taps
// send. Prices come from the suggestion (salePrices.ts, the fact sheet) and are
// always "starts at". Diesel texts never mention delete parts.
import { SHOP_PHONE } from "../shopfloor/messageTemplates";
import type { Vehicle } from "../types";
import type { NextSale } from "./nextSaleModel";
import {
  DETAIL_BOOKING_LINK,
  ERIC_BOOKING_LINK,
  SXS_TINT,
  WINDSHIELD_BROW,
} from "./salePrices";
import {
  detailRange,
  powerPackageTitle,
  tintPrice,
  vehicleName,
} from "./vehicleSales";

export interface SuggestionTextContext {
  firstName?: string | null;
  vehicle?: Vehicle | null;
  membershipPrice?: number | null;
}

const money = (n: number): string =>
  n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

const hello = (c: SuggestionTextContext) =>
  `Hi ${c.firstName?.trim() || "there"},`;
const reach = `Text or call ${SHOP_PHONE} any time.`;

/** "about two months", "about a year". */
export const roughly = (days: number): string => {
  const months = Math.round(days / 30);
  if (months >= 12) {
    const years = Math.round(months / 12);
    return years === 1 ? "about a year" : `about ${years} years`;
  }
  if (months <= 1) return "about a month";
  const words = [
    "",
    "",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
  ];
  return `about ${words[months]} months`;
};

/** The ready-to-send text for a suggestion. */
export const suggestionText = (
  sale: NextSale,
  c: SuggestionTextContext,
): string => {
  const ride = vehicleName(c.vehicle);
  switch (sale.id) {
    case "quote-follow-up":
      return `${hello(c)} just checking in on the quote for your ${sale.dealName?.trim() || ride}. Any questions, or would you like to get a time booked? ${reach}`;
    case "membership":
      return `${hello(c)} since you've been bringing the ${ride} in regularly, The Monthly Signature might suit you: a Signature detail every 30 days${c.membershipPrice ? ` for ${money(c.membershipPrice)} a month` : ""}. Want me to set it up? ${reach}`;
    case "membership-lapsed":
      return `${hello(c)} it's THE LAB. Would you like to get the ${ride} back on a monthly detail? We can pick up your membership where it left off. ${reach}`;
    case "detail-due":
      return `${hello(c)} it's been ${roughly(sale.sinceDays ?? 60)} since the ${ride} was in for a detail. Want me to hold a drop-off spot? Drop-off is 8 to 9 a.m., Monday to Friday. Book here: ${DETAIL_BOOKING_LINK}, or ${reach.toLowerCase()}`;
    case "win-back":
      return `${hello(c)} it's THE LAB in Fort St. John. It's been ${roughly(sale.sinceDays ?? 180)} since we've seen the ${ride}. Anything we can help with: a detail, tint, lighting or parts? ${reach}`;
    case "tint": {
      const tint = tintPrice(c.vehicle);
      const line = tint.what
        ? `Full ceramic on ${tint.what} starts at ${tint.range}`
        : `Ceramic on the front windows starts at ${tint.range}`;
      return `${hello(c)} have you thought about tinting the ${ride}? We install SunTek CIR Ceramic. ${line}, and Eric confirms the price once he sees it. Want a quote? ${reach}`;
    }
    case "sxs-tint":
      return `${hello(c)} getting the ${ride} ready for the season? We tint side-by-sides (Polaris, Can-Am, CFMOTO): carbon from ${SXS_TINT.carbon}, ceramic from ${SXS_TINT.ceramic}. Book a time here: ${ERIC_BOOKING_LINK}, or ${reach.toLowerCase()}`;
    case "brow":
      return `${hello(c)} want to finish off the tint on the ${ride}? A windshield brow helps with sun glare and starts at ${WINDSHIELD_BROW.from}. Want a quote? ${reach}`;
    case "detail": {
      const price = detailRange(c.vehicle);
      return `${hello(c)} thanks again for choosing THE LAB for the ${ride}. When it's due for a clean, our Complete Standard Signature detail${price ? ` starts at ${price}` : " is a good place to start"}. Drop-off is 8 to 9 a.m., Monday to Friday. Book here: ${DETAIL_BOOKING_LINK}`;
    }
    case "power-package": {
      const pkg = powerPackageTitle(c.vehicle);
      return `${hello(c)} we build diesel power packages${pkg ? ` for the ${pkg}` : ""}: tuning, exhaust and the parts that go with them. Want Eric to put a quote together for the ${ride}? ${reach}`;
    }
    case "tune":
      return `${hello(c)} you've got parts on the ${ride} from us but no tune to match yet. We tune with EZ LYNK and HP Tuners. Want Eric to put a quote together? ${reach}`;
    case "first-job":
      return `${hello(c)} thanks for reaching out to THE LAB. What can we help you with on the ${ride}? ${reach}`;
  }
};

/** A plain hello for the profile's Text button when nothing is suggested. */
export const helloText = (c: SuggestionTextContext): string =>
  `${hello(c)} it's THE LAB in Fort St. John. `;
