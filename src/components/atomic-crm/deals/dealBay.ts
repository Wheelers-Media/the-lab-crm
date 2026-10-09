// "Two Bays" from thelabfsj.ca: the Boutique (ice) and the Parts Store (amber).
export type Bay = "boutique" | "parts";

const PARTS_CATEGORIES = new Set(["tuning", "diesel-parts"]);
const BOUTIQUE_CATEGORIES = new Set([
  "window-tint",
  "sxs-tint",
  "detailing",
  "membership",
  "lighting",
  "install",
  "gridiron",
  "gift-certificate",
]);

export const dealBay = (category?: string | null): Bay | null => {
  if (!category) return null;
  if (PARTS_CATEGORIES.has(category)) return "parts";
  if (BOUTIQUE_CATEGORIES.has(category)) return "boutique";
  return null;
};

export const bayClassName = (category?: string | null): string => {
  const bay = dealBay(category);
  return bay ? `lab-bay-${bay}` : "";
};
