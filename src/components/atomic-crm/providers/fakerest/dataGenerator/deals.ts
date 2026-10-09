import { add } from "date-fns";
import { datatype, lorem, random } from "faker/locale/en_US";

import { defaultDealStages } from "../../../root/defaultConfiguration";
import type { Deal } from "../../../types";
import type { Db } from "./types";
import { randomDate } from "./utils";

// Demo-only sample jobs, using starting prices from THE LAB fact sheet.
const sampleJobs = [
  {
    name: "Ceramic tint, crew cab truck",
    category: "window-tint",
    amount: 850,
  },
  { name: "Carbon front roll-ups", category: "window-tint", amount: 180 },
  {
    name: "Ceramic front roll-ups + brow",
    category: "window-tint",
    amount: 390,
  },
  { name: "Ceramic tint, SUV", category: "window-tint", amount: 900 },
  { name: "Polaris SxS ceramic tint", category: "sxs-tint", amount: 260 },
  { name: "Can-Am SxS carbon tint", category: "sxs-tint", amount: 180 },
  { name: "Complete De-Luxx Signature", category: "detailing", amount: 499 },
  { name: "Interior De-Luxx Signature", category: "detailing", amount: 379 },
  {
    name: "Exterior Standard + engine bay",
    category: "detailing",
    amount: 249,
  },
  { name: "Monthly Signature membership", category: "membership", amount: 249 },
  { name: "Lighting package (Eric to quote)", category: "lighting", amount: 0 },
  { name: "Mud flaps install", category: "install", amount: 125 },
  {
    name: "Gridiron Prerunner front bumper",
    category: "gridiron",
    amount: 2949,
  },
  { name: "Gridiron Base front bumper", category: "gridiron", amount: 2549 },
  { name: "Tuning (Eric to quote)", category: "tuning", amount: 0 },
  { name: "Gift certificate", category: "gift-certificate", amount: 200 },
];

export const generateDeals = (db: Db): Deal[] => {
  const deals = Array.from(Array(50).keys()).map((id) => {
    const company = random.arrayElement(db.companies);
    company.nb_deals = (company.nb_deals ?? 0) + 1;
    const contacts = random.arrayElements(
      db.contacts.filter((contact) => contact.company_id === company.id),
      datatype.number({ min: 1, max: 3 }),
    );
    const job = random.arrayElement(sampleJobs);
    const created_at = randomDate(new Date(company.created_at)).toISOString();

    const expected_closing_date = randomDate(
      new Date(created_at),
      add(new Date(created_at), { months: 6 }),
    )
      .toISOString()
      .split("T")[0];

    return {
      id,
      name: job.name,
      company_id: company.id,
      contact_ids: contacts.map((contact) => contact.id),
      category: job.category,
      stage: random.arrayElement(defaultDealStages).value,
      description: lorem.paragraphs(datatype.number({ min: 1, max: 4 })),
      amount: job.amount,
      created_at,
      updated_at: randomDate(new Date(created_at)).toISOString(),
      expected_closing_date,
      sales_id: company.sales_id!,
      index: 0,
      lead_source: random.arrayElement([
        "website",
        "website",
        "phone",
        "walk-in",
        "cal.com",
      ]),
      stage_changed_at: randomDate(new Date(created_at)).toISOString(),
    };
  });
  // compute index based on stage
  defaultDealStages.forEach((stage) => {
    deals
      .filter((deal) => deal.stage === stage.value)
      .forEach((deal, index) => {
        deals[deal.id].index = index;
      });
  });
  return deals;
};
