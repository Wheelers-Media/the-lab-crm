// The suggestions that depend on what the customer drives. Kept apart from
// nextSaleModel.ts so the vehicle rules read on their own. Prices come only
// from salePrices.ts (the fact sheet). Diesel suggestions point at the
// website's power packages and tunes; they never name delete parts.
import { powerPackageFor } from "../packages/powerPackageModel";
import { quoteContext } from "../packages/quoteModel";
import type { Vehicle } from "../types";
import { vehicleLabel } from "../vehicles/vehicleModel";
import {
  CERAMIC_FRONT_ROLL_UPS,
  COMPLETE_SIGNATURE,
  FULL_CERAMIC_TINT,
  SXS_TINT,
  WINDSHIELD_BROW,
} from "./salePrices";

export type VehicleSaleId = "sxs-tint" | "power-package" | "brow";

export interface RankedSale<Id extends string = string> {
  id: Id;
  title: string;
  reason: string;
  /** "From $850-$1,100 ceramic": a fact-sheet starting price, when there is one. */
  price?: string;
  action: "quote" | "book" | "text" | "open-quote";
  rank: number;
}

export const isSxs = (v?: Vehicle | null): boolean =>
  v?.platform === "sxs" || v?.size_class === "sxs";

/** "2022 Ram 3500", or "truck" when nothing is on file. */
export const vehicleName = (v?: Vehicle | null): string => {
  const label = vehicleLabel(v);
  return label && label !== "Vehicle"
    ? label
    : isSxs(v)
      ? "side-by-side"
      : "truck";
};

/** The full-vehicle ceramic price for this vehicle, else the front roll-ups price. */
export const tintPrice = (
  v?: Vehicle | null,
): { label: string; range: string; what: string | null } => {
  const full = v?.size_class ? FULL_CERAMIC_TINT[v.size_class] : undefined;
  return full
    ? {
        label: `From ${full.price} ceramic`,
        range: full.price,
        what: full.what,
      }
    : {
        label: `Front roll-ups from ${CERAMIC_FRONT_ROLL_UPS} ceramic`,
        range: CERAMIC_FRONT_ROLL_UPS,
        what: null,
      };
};

/** The Complete Standard Signature price for this vehicle's size, if listed. */
export const detailRange = (v?: Vehicle | null): string | undefined =>
  v?.size_class ? COMPLETE_SIGNATURE[v.size_class] : undefined;

export const detailPrice = (v?: Vehicle | null): string | undefined => {
  const price = detailRange(v);
  return price ? `Complete Standard Signature from ${price}` : undefined;
};

/** The website power package built for this truck, if there is one. */
export const powerPackageTitle = (v?: Vehicle | null): string | null =>
  v ? (powerPackageFor(quoteContext({ vehicle: v }))?.title ?? null) : null;

interface VehicleSaleInput {
  vehicle?: Vehicle | null;
  /** Kinds of work they have paid for. */
  hasTint: boolean;
  hasTune: boolean;
  /** Names of every line they have paid for, to spot a brow or roof already done. */
  lineNames: string[];
}

export const vehicleSales = ({
  vehicle,
  hasTint,
  hasTune,
  lineNames,
}: VehicleSaleInput): Array<RankedSale<VehicleSaleId>> => {
  if (!vehicle) return [];
  const out: Array<RankedSale<VehicleSaleId>> = [];
  const name = vehicleName(vehicle);

  // Northern BC rides side-by-sides: tint them like a truck
  if (isSxs(vehicle) && !hasTint) {
    out.push({
      id: "sxs-tint",
      title: "Offer side-by-side tint",
      reason: `Their ${name} has never been tinted with us.`,
      price: `Carbon from ${SXS_TINT.carbon}, ceramic from ${SXS_TINT.ceramic}`,
      action: "quote",
      rank: 60,
    });
  }

  const pkg = hasTune ? null : powerPackageTitle(vehicle);
  if (pkg) {
    out.push({
      id: "power-package",
      title: "Offer the power package",
      reason: `Their ${name} matches the website's ${pkg} build, and they have no tune from us yet.`,
      action: "quote",
      rank: 55,
    });
  }

  const hasBrow = lineNames.some((n) => /brow|visor/i.test(n));
  if (hasTint && !hasBrow && !isSxs(vehicle)) {
    out.push({
      id: "brow",
      title: "Add a windshield brow",
      reason: "They have tint from us but no windshield brow.",
      price: `${WINDSHIELD_BROW.from}-${WINDSHIELD_BROW.to}`,
      action: "quote",
      rank: 35,
    });
  }

  return out;
};
