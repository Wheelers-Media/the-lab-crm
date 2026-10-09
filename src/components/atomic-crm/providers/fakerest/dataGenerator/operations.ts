// Demo-only orders, appointments and checkouts, so the preview dashboard and
// calendar have something to show. Prices are fact-sheet starting prices.
import { datatype, random } from "faker/locale/en_US";

import {
  addDays,
  mondayOf,
  shopDayKey,
  startOfShopDay,
} from "../../../operations/shopTime";
import type { Appointment, Order, ShopifyCheckout } from "../../../types";
import type { Db } from "./types";

const DAY_MS = 86_400_000;

const ORDER_LINES = [
  {
    name: "De-Luxx Interior Detail 5-6 Seater",
    price: 379,
    category: "Detailing",
  },
  {
    name: "Standard Interior Detail 5 & 6 Seater",
    price: 249,
    category: "Detailing",
  },
  { name: "Maintenance Detail", price: 149, category: "Detailing" },
  {
    name: "Suntek - Ceramic Tint - Front Roll Ups",
    price: 260,
    category: "Tint",
  },
  { name: "18% Suntek Carbon Tint", price: 180, category: "Tint" },
  { name: "Mechanical Shop Rate", price: 125, category: "Mechanical" },
  {
    name: "AMDP EZ LYNK Custom Tuning Support Package",
    price: 1845,
    category: "Tuning",
  },
  {
    name: "Speed Demon Hi-Lux 2.0 Light Bar",
    price: 489,
    category: "Lighting",
  },
  { name: "$50 Secure Booking Deposit", price: 50, category: "Deposit" },
];

const BAY_JOBS = [
  "Complete De-Luxx Signature",
  "Interior Standard",
  "Exterior Standard + engine bay",
  "Maintenance Detail",
];
const ERIC_JOBS = [
  "Ceramic tint, crew cab",
  "Carbon front roll-ups",
  "Polaris SxS ceramic tint",
  "Tuning install",
  "Light bar install",
  "Gridiron bumper install",
];
const VEHICLES = [
  "2021 Ram 3500",
  "2019 Chevrolet Tahoe",
  "2022 Ford F-350",
  "2020 GMC Sierra 2500",
  "2018 Toyota Highlander",
  "2023 Polaris RZR",
];

export const generateOrders = (db: Db): Order[] => {
  const now = Date.now();
  return Array.from({ length: 140 }, (_, id) => {
    const lines = random
      .arrayElements(ORDER_LINES, datatype.number({ min: 1, max: 3 }))
      .map((l) => ({ name: l.name, quantity: 1, price: l.price }));
    const total = lines.reduce((s, l) => s + l.price, 0) * 1.05;
    return {
      id,
      order_number: `#${1600 + id}`,
      contact_id: random.arrayElement(db.contacts).id,
      source: random.arrayElement(["pos", "pos", "web", "shopify_draft_order"]),
      financial_status: "paid",
      currency: "CAD",
      total: Math.round(total * 100) / 100,
      refunded_amount: 0,
      line_items: lines,
      categories: [
        ...new Set(
          lines.map(
            (l) => ORDER_LINES.find((o) => o.name === l.name)!.category,
          ),
        ),
      ],
      is_deposit: lines.some((l) => l.name.includes("Deposit")),
      ordered_at: new Date(
        now -
          datatype.number({ min: 0, max: 62 }) * DAY_MS -
          datatype.number(36_000_000),
      ).toISOString(),
      cancelled_at: null,
    };
  });
};

export const generateAppointments = (db: Db): Appointment[] => {
  const monday = mondayOf(shopDayKey(new Date()));
  const appointments: Appointment[] = [];
  for (let d = 0; d < 12; d++) {
    const key = addDays(monday, d);
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const dayStart = startOfShopDay(key).getTime();
    const bayCount = datatype.number({ min: 0, max: 2 });
    for (let b = 0; b < bayCount; b++) {
      const start = dayStart + (8 * 60 + b * 30) * 60_000;
      appointments.push({
        id: appointments.length,
        source: "cal.com",
        contact_id: random.arrayElement(db.contacts).id,
        title: `Drop-off: ${random.arrayElement(BAY_JOBS)}`,
        resource: "detailing-bay",
        start_at: new Date(start).toISOString(),
        end_at: new Date(start + 8 * 3_600_000).toISOString(),
        status: "booked",
        deposit_paid: datatype.number(9) > 1,
        vehicle: random.arrayElement(VEHICLES),
        notes: null,
      });
    }
    const ericCount = datatype.number({ min: 0, max: 3 });
    for (let e = 0; e < ericCount; e++) {
      const start = dayStart + (10 * 60 + e * 150) * 60_000;
      appointments.push({
        id: appointments.length,
        source: "cal.com",
        contact_id: random.arrayElement(db.contacts).id,
        title: random.arrayElement(ERIC_JOBS),
        resource: "eric",
        start_at: new Date(start).toISOString(),
        end_at: new Date(start + 2 * 3_600_000).toISOString(),
        status: "booked",
        deposit_paid: datatype.number(9) > 1,
        vehicle: random.arrayElement(VEHICLES),
        notes: null,
      });
    }
  }
  return appointments;
};

export const generateCheckouts = (db: Db): ShopifyCheckout[] => [
  {
    id: 0,
    checkout_token: "demo-1",
    contact_id: random.arrayElement(db.contacts).id,
    customer_name: "Demo customer",
    total: 2640,
    checkout_updated_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    completed_at: null,
  },
];
