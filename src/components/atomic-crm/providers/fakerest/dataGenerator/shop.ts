import { datatype, random } from "faker/locale/en_US";

import type {
  Appointment,
  AppointmentStatus,
  Order,
  OrderLineItem,
  ShopifyCheckout,
} from "../../../types";
import type { Db } from "./types";
import { randomDate, weightedBoolean } from "./utils";

// Demo catalogue: real THE LAB product names and starting prices (CAD).
const CATALOGUE: Array<{ name: string; price: number; category: string }> = [
  {
    name: "Universal Fit - Suntek - Ceramic Tint - Front Roll Ups",
    price: 260,
    category: "Tint",
  },
  {
    name: "Universal Fit - Suntek - Carbon Tint - Front Roll Ups",
    price: 180,
    category: "Tint",
  },
  {
    name: "Universal Fit - Suntek - Ceramic Tint - Windshield Brow (1 Piece)",
    price: 180,
    category: "Tint",
  },
  {
    name: "Universal Fit - Suntek - SxS Ceramic Tint",
    price: 260,
    category: "Tint",
  },
  {
    name: "De-luxx Signature (Small SUV, Truck)",
    price: 499,
    category: "Detailing",
  },
  {
    name: "Standard Signature (Small SUV/Truck)",
    price: 329,
    category: "Detailing",
  },
  {
    name: "Universal Fit - THE LAB - Standard Interior Detail 5 & 6 Seater",
    price: 249,
    category: "Detailing",
  },
  {
    name: "Universal Fit - THE LAB - Headlight Restoration",
    price: 150,
    category: "Detailing",
  },
  {
    name: "Universal Fit - THE LAB - Odour Elimination (Ozone)",
    price: 70,
    category: "Detailing",
  },
  {
    name: '2017-2025 Duramax 6.6L - Polar - 4" Exhaust With Muffler',
    price: 1083,
    category: "Diesel parts",
  },
  {
    name: 'Universal – Hi-Lux 2.0 Dual Row 20" LED Light Bar, 10-10152',
    price: 368.99,
    category: "Lighting",
  },
  {
    name: "Universal Fit - THE LAB - Mechanical Shop Rate",
    price: 125,
    category: "Mechanical",
  },
  { name: "The Lab Gift Card", price: 100, category: "Gift card" },
];
const DEPOSIT: OrderLineItem = {
  name: "$50 Secure Booking Deposit",
  quantity: 1,
  price: 50,
};

const pickLines = (count: number) => {
  const picked = random.arrayElements(CATALOGUE, count);
  return {
    lines: picked.map<OrderLineItem>((p) => ({
      name: p.name,
      quantity: 1,
      price: p.price,
    })),
    categories: [...new Set(picked.map((p) => p.category))].sort(),
  };
};

const sum = (lines: OrderLineItem[]) =>
  Math.round(lines.reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100;

export const generateOrders = (db: Db): Order[] =>
  Array.from(Array(150).keys()).map<Order>((id) => {
    const contact = random.arrayElement(db.contacts);
    const isDeposit = weightedBoolean(20);
    const { lines, categories } = isDeposit
      ? { lines: [DEPOSIT], categories: ["Deposit"] }
      : pickLines(datatype.number({ min: 1, max: 3 }));
    const total = sum(lines);
    const orderedAt = randomDate(
      new Date(Date.now() - 365 * 864e5),
    ).toISOString();
    const refunded = !isDeposit && weightedBoolean(4) ? lines[0].price : 0;
    return {
      id,
      shopify_order_id: String(6100000000 + id),
      order_number: `#${1200 + id}`,
      contact_id: weightedBoolean(95) ? contact.id : null,
      deal_id: null,
      source: random.arrayElement(["web", "pos", "shopify_draft_order"]),
      financial_status: refunded ? "partially_refunded" : "paid",
      fulfillment_status: null,
      currency: "CAD",
      subtotal: total,
      total,
      refunded_amount: refunded,
      line_items: lines,
      categories,
      is_deposit: isDeposit,
      ordered_at: orderedAt,
      cancelled_at: !isDeposit && weightedBoolean(2) ? orderedAt : null,
      created_at: orderedAt,
      sales_id: contact.sales_id,
    };
  });

export const generateCheckouts = (db: Db): ShopifyCheckout[] =>
  Array.from(Array(14).keys()).map<ShopifyCheckout>((id) => {
    const contact = weightedBoolean(60)
      ? random.arrayElement(db.contacts)
      : null;
    const big = id < 4;
    const lines: OrderLineItem[] = big
      ? [
          {
            name: "Gridiron Prerunner Front Bumper (Winch)",
            quantity: 1,
            price: 4299,
          },
        ]
      : pickLines(datatype.number({ min: 1, max: 2 })).lines;
    const updated = randomDate(new Date(Date.now() - 10 * 864e5)).toISOString();
    return {
      id,
      checkout_token: `demo-checkout-${id}`,
      contact_id: contact?.id ?? null,
      email: contact?.email_jsonb?.[0]?.email ?? `customer${id}@example.com`,
      phone: contact?.phone_jsonb?.[0]?.number ?? null,
      customer_name: contact
        ? `${contact.first_name} ${contact.last_name}`
        : null,
      total: sum(lines),
      line_items: lines,
      recovery_url: `https://xr6pmx-y0.myshopify.com/checkouts/recover/demo-${id}`,
      completed_at: id % 5 === 4 ? updated : null,
      task_id: null,
      checkout_updated_at: updated,
      created_at: updated,
    };
  });

const SERVICES: Array<{
  title: string;
  resource: Appointment["resource"];
  hours: number;
}> = [
  { title: "Complete De-Luxx Signature", resource: "detailing-bay", hours: 4 },
  { title: "Interior Standard", resource: "detailing-bay", hours: 2 },
  { title: "Ceramic tint, full vehicle", resource: "eric", hours: 4 },
  { title: "SxS ceramic tint", resource: "eric", hours: 3 },
  { title: "Gridiron bumper install", resource: "eric", hours: 3 },
  { title: "Custom lighting install", resource: "eric", hours: 2 },
];
const VEHICLES = [
  "2021 Ram 3500 Cummins",
  "2019 F-350 Powerstroke",
  "2023 Silverado 2500 Duramax",
  "2022 Polaris RZR",
  "2020 Can-Am Defender",
  "2024 Tahoe",
];

export const generateAppointments = (db: Db): Appointment[] =>
  Array.from(Array(24).keys()).map<Appointment>((id) => {
    const contact = random.arrayElement(db.contacts);
    const service = random.arrayElement(SERVICES);
    // Half in the past two weeks, half in the next two weeks, at 8 a.m. or 1 p.m.
    const day = new Date();
    day.setDate(
      day.getDate() +
        (id % 2 === 0 ? -1 : 1) * datatype.number({ min: 0, max: 14 }),
    );
    // The shop is closed weekends: push Saturday and Sunday to Monday
    if (day.getDay() === 6) day.setDate(day.getDate() + 2);
    if (day.getDay() === 0) day.setDate(day.getDate() + 1);
    day.setHours(id % 3 === 0 ? 13 : 8, 0, 0, 0);
    const start = day.toISOString();
    const end = new Date(day.getTime() + service.hours * 36e5).toISOString();
    const isPast = day.getTime() < Date.now();
    const status: AppointmentStatus = isPast
      ? random.arrayElement(["completed", "completed", "completed", "no_show"])
      : random.arrayElement(["booked", "booked", "booked", "rescheduled"]);
    return {
      id,
      external_id: `demo-booking-${id}`,
      source: "calcom",
      contact_id: contact.id,
      deal_id: null,
      task_id: null,
      title: service.title,
      resource: service.resource,
      start_at: start,
      end_at: end,
      status,
      deposit_paid: isPast || weightedBoolean(70),
      vehicle: random.arrayElement(VEHICLES),
      notes: null,
      created_at: start,
      updated_at: start,
      sales_id: contact.sales_id,
    };
  });
