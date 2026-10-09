import { random } from "faker/locale/en_US";

import { ENGINES } from "../../../vehicles/vehicleModel";
import type {
  Vehicle,
  VehiclePlatform,
  VehicleSizeClass,
} from "../../../types";
import type { Db } from "./types";
import { weightedBoolean } from "./utils";

type Template = {
  make: string;
  model: string;
  trims: string[];
  platform: VehiclePlatform;
  size_class: VehicleSizeClass;
  years: [number, number];
};

// The trucks and toys that come through a Fort St. John shop.
const TEMPLATES: Template[] = [
  {
    make: "Ram",
    model: "3500",
    trims: ["Laramie", "Limited", "Big Horn"],
    platform: "cummins",
    size_class: "truck",
    years: [2013, 2025],
  },
  {
    make: "Ram",
    model: "2500",
    trims: ["Tradesman", "Laramie", "Power Wagon"],
    platform: "cummins",
    size_class: "truck",
    years: [2010, 2025],
  },
  {
    make: "GMC",
    model: "Sierra 2500HD",
    trims: ["SLE", "AT4", "Denali"],
    platform: "duramax",
    size_class: "truck",
    years: [2011, 2025],
  },
  {
    make: "Chevrolet",
    model: "Silverado 3500HD",
    trims: ["LT", "LTZ", "High Country"],
    platform: "duramax",
    size_class: "truck",
    years: [2007, 2025],
  },
  {
    make: "Ford",
    model: "F-350",
    trims: ["XLT", "Lariat", "Platinum"],
    platform: "powerstroke",
    size_class: "truck",
    years: [2008, 2025],
  },
  {
    make: "Ford",
    model: "F-250",
    trims: ["XLT", "Lariat", "Tremor"],
    platform: "powerstroke",
    size_class: "truck",
    years: [2011, 2025],
  },
  {
    make: "Ford",
    model: "F-150",
    trims: ["XLT", "Lariat", "Raptor"],
    platform: "gas",
    size_class: "truck",
    years: [2015, 2025],
  },
  {
    make: "Toyota",
    model: "Tundra",
    trims: ["SR5", "TRD Pro", "Platinum"],
    platform: "gas",
    size_class: "truck",
    years: [2014, 2025],
  },
  {
    make: "Chevrolet",
    model: "Tahoe",
    trims: ["LT", "Z71", "RST"],
    platform: "gas",
    size_class: "suv-7-8",
    years: [2016, 2025],
  },
  {
    make: "Jeep",
    model: "Grand Cherokee",
    trims: ["Laredo", "Limited", "Overland"],
    platform: "gas",
    size_class: "suv-5-6",
    years: [2014, 2025],
  },
  {
    make: "Honda",
    model: "Civic",
    trims: ["LX", "Sport", "Touring"],
    platform: "gas",
    size_class: "car",
    years: [2016, 2025],
  },
  {
    make: "Polaris",
    model: "RZR Pro R",
    trims: ["Premium", "Ultimate"],
    platform: "sxs",
    size_class: "sxs",
    years: [2020, 2025],
  },
  {
    make: "Can-Am",
    model: "Maverick X3",
    trims: ["DS Turbo", "RS Turbo RR"],
    platform: "sxs",
    size_class: "sxs",
    years: [2018, 2025],
  },
  {
    make: "CFMOTO",
    model: "ZForce 950",
    trims: ["Sport", "HO EX"],
    platform: "sxs",
    size_class: "sxs",
    years: [2021, 2025],
  },
];

const MODS: Record<string, string[]> = {
  diesel: [
    "EZ LYNK tune, 5in exhaust",
    "Gridiron Prerunner bumper, Baja Designs pods",
    "HP Tuners, Polar Diesel tune, 4in turbo-back",
    "Morimoto headlights, 18% ceramic tint all round",
  ],
  gas: ["Morimoto tails, 20% ceramic tint", "Diode Dynamics fogs", ""],
  sxs: ["Front and rear ceramic tint", "Baja Designs light bar", ""],
};

const COLOURS = [
  "Black",
  "White",
  "Granite",
  "Bright Silver",
  "Red",
  "Army Green",
];

export const generateVehicles = (db: Db): Vehicle[] => {
  const vehicles: Vehicle[] = [];
  db.contacts.forEach((contact) => {
    const count = weightedBoolean(80) ? (weightedBoolean(20) ? 2 : 1) : 0;
    for (let i = 0; i < count; i++) {
      const t = random.arrayElement(TEMPLATES);
      const year = random.number({ min: t.years[0], max: t.years[1] });
      const engines = ENGINES[t.platform];
      const modsKey =
        t.platform === "sxs" ? "sxs" : t.platform === "gas" ? "gas" : "diesel";
      vehicles.push({
        id: vehicles.length,
        contact_id: contact.id,
        company_id: null,
        year,
        make: t.make,
        model: t.model,
        trim: random.arrayElement(t.trims),
        platform: t.platform,
        engine: engines ? random.arrayElement(engines) : null,
        transmission: null,
        size_class: t.size_class,
        vin: null,
        plate: weightedBoolean(40)
          ? `${random.alphaNumeric(3).toUpperCase()} ${random.number({ min: 100, max: 999 })}`
          : null,
        colour: random.arrayElement(COLOURS),
        mods: random.arrayElement(MODS[modsKey]) || null,
        notes: null,
        is_primary: i === 0,
        created_at: contact.first_seen,
        updated_at: contact.first_seen,
        sales_id: contact.sales_id ?? null,
      });
    }
  });
  return vehicles;
};

/** Search text the real contacts_summary view builds from the vehicles. */
export const vehiclesFts = (vehicles: Vehicle[]): string =>
  vehicles
    .map((v) =>
      [v.year, v.make, v.model, v.trim, v.engine, v.vin, v.plate]
        .filter(Boolean)
        .join(" "),
    )
    .join(" | ");
