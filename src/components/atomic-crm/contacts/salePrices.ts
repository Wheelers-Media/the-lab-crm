// Starting prices the profile's suggestions and texts may quote. Every number
// here comes from THE LAB fact sheet (verified 2026-10-07, CAD, "starting at";
// Eric confirms the final price after he sees the vehicle). Change them here
// when the fact sheet changes, and nowhere else.
import type { VehicleSizeClass } from "../types";

export { INSTALL_BOOKING_LINK as ERIC_BOOKING_LINK } from "../shopfloor/messageTemplates";

/** Full-vehicle SunTek CIR Ceramic tint, by size. */
export const FULL_CERAMIC_TINT: Partial<
  Record<VehicleSizeClass, { what: string; price: string }>
> = {
  car: { what: "a sedan", price: "$700-$900" },
  truck: { what: "a crew cab truck", price: "$850-$1,100" },
  "suv-7-8": { what: "an SUV", price: "$900-$1,300" },
};

/** Used when the size does not pin down a full-vehicle price. */
export const CERAMIC_FRONT_ROLL_UPS = "$260";

export const SXS_TINT = { carbon: "$180", ceramic: "$260" };

/** 2-piece carbon to 1-piece ceramic. */
export const WINDSHIELD_BROW = { from: "$90", to: "$180" };

/** Complete Standard Signature, by size. The fact sheet has no sedan price. */
export const COMPLETE_SIGNATURE: Partial<Record<VehicleSizeClass, string>> = {
  "suv-5-6": "$329",
  truck: "$329",
  "suv-7-8": "$379",
};

export const DETAIL_BOOKING_LINK = "https://cal.com/the-lab/detailing-drop-off";
