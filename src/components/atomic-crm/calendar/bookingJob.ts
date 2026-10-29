import type { Identifier } from "ra-core";

import { quoteTotals } from "../packages/quoteModel";
import type { Deal, DealPackageLine } from "../types";

/** Stages a booked job moves forward from; later ones are left where they are. */
const BEFORE_BOOKED = new Set(["intake", "qualified", "quoted"]);

/**
 * What changes on an existing job when a booking adds products to it: the
 * lines join its quote, the amount follows the new total, and a job still
 * being talked about moves to Booked.
 */
export const jobPatchForBooking = (
  deal: Pick<Deal, "packages" | "stage">,
  lines: DealPackageLine[],
  now: Date = new Date(),
): Partial<Deal> => {
  const packages = [...(deal.packages ?? []), ...lines];
  return {
    packages,
    amount: Math.round(quoteTotals(packages).total),
    ...(BEFORE_BOOKED.has(deal.stage)
      ? { stage: "booked", stage_changed_at: now.toISOString() }
      : {}),
  };
};

/** A new Booked job for a booking that came with products and no open job. */
export const newJobForBooking = ({
  title,
  contactId,
  companyId,
  vehicleId,
  salesId,
  day,
  lines,
  now = new Date(),
}: {
  title: string;
  contactId: Identifier;
  companyId?: Identifier | null;
  vehicleId?: Identifier | null;
  salesId?: Identifier;
  /** The booking's shop day, YYYY-MM-DD. */
  day: string;
  lines: DealPackageLine[];
  now?: Date;
}): Partial<Deal> => ({
  name: title.trim() || "Booked job",
  contact_ids: [contactId],
  ...(companyId != null ? { company_id: companyId } : {}),
  vehicle_id: vehicleId ?? null,
  sales_id: salesId,
  stage: "booked",
  stage_changed_at: now.toISOString(),
  amount: Math.round(quoteTotals(lines).total),
  index: 0,
  expected_closing_date: day,
  packages: lines,
});

/** The open job a booking most likely belongs to: the customer's latest one still open. */
export const likelyJob = (
  deals: Array<Pick<Deal, "id" | "stage" | "updated_at" | "archived_at">>,
): Identifier | null => {
  const open = deals
    .filter((d) => !d.archived_at && d.stage !== "won" && d.stage !== "lost")
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  return open[0]?.id ?? null;
};
