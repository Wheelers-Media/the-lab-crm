import { generateCompanies } from "./companies";
import { generateContactNotes } from "./contactNotes";
import { generateContacts } from "./contacts";
import { generateDealNotes } from "./dealNotes";
import { generateDeals } from "./deals";
import { finalize } from "./finalize";
import { generateSales } from "./sales";
import {
  generateAppointments,
  generateCheckouts,
  generateOrders,
} from "./shop";
import { generateTags } from "./tags";
import { generateTasks } from "./tasks";
import type { Db } from "./types";
import { generateVehicles, vehiclesFts } from "./vehicles";

export default (): Db => {
  const db = {} as Db;
  db.sales = generateSales(db);
  db.tags = generateTags(db);
  db.companies = generateCompanies(db);
  db.contacts = generateContacts(db);
  db.vehicles = generateVehicles(db);
  db.contacts.forEach((contact) => {
    const owned = db.vehicles.filter((v) => v.contact_id === contact.id);
    contact.vehicles_fts = vehiclesFts(owned);
    const main = owned.find((v) => v.is_primary) ?? owned[0];
    contact.vehicle_label = main
      ? [main.year, main.make, main.model].filter(Boolean).join(" ")
      : null;
  });
  db.contact_notes = generateContactNotes(db);
  db.deals = generateDeals(db);
  db.deals.forEach((deal) => {
    const vehicle = db.vehicles.find(
      (v) => v.contact_id === deal.contact_ids?.[0] && v.is_primary,
    );
    deal.vehicle_id = vehicle?.id ?? null;
  });
  db.deal_notes = generateDealNotes(db);
  db.tasks = generateTasks(db);
  db.orders = generateOrders(db);
  db.shopify_checkouts = generateCheckouts(db);
  db.appointments = generateAppointments(db);
  db.configuration = [
    {
      id: 1,
      config: {} as Db["configuration"][number]["config"],
    },
  ];
  finalize(db);

  return db;
};
