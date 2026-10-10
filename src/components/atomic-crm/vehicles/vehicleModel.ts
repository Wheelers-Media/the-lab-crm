// Vehicle vocabulary shared with thelabfsj.ca: the platforms and engine lists
// match the site's truck selector (src/assets/js/vehicle-selector.js), and the
// size classes match how detailing and tint are priced on the fact sheet.
import type { Vehicle, VehiclePlatform, VehicleSizeClass } from "../types";

export const PLATFORM_CHOICES: Array<{ id: VehiclePlatform; name: string }> = [
  { id: "cummins", name: "Cummins (Ram)" },
  { id: "duramax", name: "Duramax (GM)" },
  { id: "powerstroke", name: "Powerstroke (Ford)" },
  { id: "half-ton", name: "Half-ton diesel" },
  { id: "kenworth", name: "Kenworth / heavy truck" },
  { id: "gas", name: "Gas car, SUV or truck" },
  { id: "sxs", name: "Side-by-side (SxS)" },
  { id: "other", name: "Other" },
];

export const ENGINES: Partial<Record<VehiclePlatform, string[]>> = {
  cummins: [
    "2019+ 6.7L Cummins (HO)",
    "2019+ 6.7L Cummins (SO)",
    "2013-2018 6.7L Cummins",
    "2010-2012 6.7L Cummins",
    "2007.5-2009 6.7L Cummins",
    "2003-2007 5.9L Cummins",
    "1998.5-2002 5.9L Cummins (24V)",
    "1989-1998 5.9L Cummins (12V)",
    "3.0L EcoDiesel",
  ],
  duramax: [
    "2017+ 6.6L L5P Duramax",
    "2011-2016 6.6L LML Duramax",
    "2007.5-2010 6.6L LMM Duramax",
    "2006-2007 6.6L LBZ Duramax",
    "2004.5-2005 6.6L LLY Duramax",
    "2001-2004 6.6L LB7 Duramax",
    "3.0L LM2/LZ0 Duramax",
  ],
  powerstroke: [
    "2020+ 6.7L Powerstroke",
    "2017-2019 6.7L Powerstroke",
    "2011-2016 6.7L Powerstroke",
    "2008-2010 6.4L Powerstroke",
    "2003-2007 6.0L Powerstroke",
    "1994-2003 7.3L Powerstroke",
    "3.0L Powerstroke",
    "2018-2024 Expedition 3.5L EcoBoost",
    "2023-2026 Expedition Interceptor 3.5L EcoBoost",
  ],
  "half-ton": [
    "2014-2023 EcoDiesel 3.0L",
    "2016-2022 Duramax 2.8L LWN",
    "2019-2022 Duramax 3.0L LM2/LZ0",
    "2018-2021 Powerstroke 3.0L",
    "2016-2019 Nissan Titan 5.0L Cummins",
  ],
  kenworth: ["2021-2026 PACCAR MX-13 / Cummins X15"],
};

export const SIZE_CLASS_CHOICES: Array<{ id: VehicleSizeClass; name: string }> =
  [
    { id: "car", name: "Car or sedan" },
    { id: "suv-5-6", name: "Small SUV or truck (5-6 seats)" },
    { id: "suv-7-8", name: "Large SUV or van (7-8 seats)" },
    { id: "truck", name: "Crew cab truck" },
    { id: "sxs", name: "Side-by-side" },
    { id: "commercial", name: "Commercial or heavy truck" },
  ];

export const DIESEL_PLATFORMS: VehiclePlatform[] = [
  "cummins",
  "duramax",
  "powerstroke",
  "half-ton",
  "kenworth",
];

export const platformName = (platform?: string | null): string =>
  PLATFORM_CHOICES.find((p) => p.id === platform)?.name ?? "";

export const sizeClassName = (size?: string | null): string =>
  SIZE_CLASS_CHOICES.find((s) => s.id === size)?.name ?? "";

/** "2022 Ram 3500 Laramie", or "Vehicle" when nothing is filled in yet. */
export const vehicleLabel = (v?: Partial<Vehicle> | null): string =>
  v
    ? [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ") || "Vehicle"
    : "";

/** VINs are 17 characters with no I, O or Q. Older vehicles may be shorter. */
export const validateVin = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const vin = value.trim().toUpperCase();
  if (vin.length > 17) return "A VIN has 17 characters at most";
  if (/[IOQ]/.test(vin)) return "VINs never use the letters I, O or Q";
  if (!/^[A-Z0-9]+$/.test(vin)) return "Letters and numbers only";
  return undefined;
};

export const normalizeVin = (value?: string | null): string | null =>
  value ? value.trim().toUpperCase() : null;
