import { datatype } from "faker/locale/en_US";

import type { TrafficRow } from "../../../numbers/trafficModel";
import { addDays, shopDayKey } from "../../../operations/shopTime";

// What a small shop's store roughly sees: most visits arrive direct, the
// shop's own website sends the ones who mean it, social sends the browsers.
// weight is a share of a day's visits; the rest are how far such a visit gets.
const MIX = [
  {
    source: "direct",
    name: "",
    device: "mobile",
    weight: 28,
    cart: 0.1,
    checkout: 0.06,
    buy: 0.015,
  },
  {
    source: "direct",
    name: "",
    device: "desktop",
    weight: 18,
    cart: 0.16,
    checkout: 0.1,
    buy: 0.03,
  },
  {
    source: "unknown",
    name: "thelabfsj",
    device: "mobile",
    weight: 14,
    cart: 0.3,
    checkout: 0.22,
    buy: 0.06,
  },
  {
    source: "unknown",
    name: "thelabfsj",
    device: "desktop",
    weight: 8,
    cart: 0.34,
    checkout: 0.25,
    buy: 0.09,
  },
  {
    source: "social",
    name: "facebook",
    device: "mobile",
    weight: 12,
    cart: 0.06,
    checkout: 0.035,
    buy: 0.008,
  },
  {
    source: "social",
    name: "instagram",
    device: "mobile",
    weight: 5,
    cart: 0.05,
    checkout: 0.03,
    buy: 0.006,
  },
  {
    source: "search",
    name: "google",
    device: "mobile",
    weight: 8,
    cart: 0.08,
    checkout: 0.05,
    buy: 0.012,
  },
  {
    source: "search",
    name: "google",
    device: "desktop",
    weight: 5,
    cart: 0.12,
    checkout: 0.08,
    buy: 0.02,
  },
  {
    source: "email",
    name: "gmail",
    device: "mobile",
    weight: 4,
    cart: 0.2,
    checkout: 0.15,
    buy: 0.06,
  },
] as const;

const WEIGHT_TOTAL = MIX.reduce((s, m) => s + m.weight, 0);
const DAYS = 730;

/**
 * A visit count that wobbles around its expected value. The fraction is the
 * chance of one more, so a 2% rate still produces a purchase now and then.
 */
const around = (expected: number): number => {
  const value = expected * (0.5 + datatype.number(100) / 100);
  const whole = Math.floor(value);
  return whole + (datatype.number(999) / 1000 < value - whole ? 1 : 0);
};

export const generateTraffic = (): TrafficRow[] => {
  const today = shopDayKey(new Date());
  const syncedAt = new Date().toISOString();
  const rows: TrafficRow[] = [];
  for (let i = 0; i < DAYS; i++) {
    const day = addDays(today, -i);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    // Weekends are quiet, and the shop grows a little over the two years
    const growth = 1 - (i / DAYS) * 0.4;
    const visits =
      datatype.number({ min: 8, max: 30 }) *
      (weekday === 0 || weekday === 6 ? 0.6 : 1) *
      growth;
    for (const m of MIX) {
      const sessions = around((visits * m.weight) / WEIGHT_TOTAL);
      if (!sessions) continue;
      const carts = Math.min(sessions, around(sessions * m.cart));
      const checkouts = Math.min(sessions, around(sessions * m.checkout));
      rows.push({
        id: rows.length,
        day,
        referrer_source: m.source,
        referrer_name: m.name,
        device_type: m.device,
        sessions,
        cart_sessions: carts,
        checkout_sessions: checkouts,
        completed_sessions: Math.min(checkouts, around(sessions * m.buy)),
        synced_at: syncedAt,
      });
    }
  }
  return rows;
};
