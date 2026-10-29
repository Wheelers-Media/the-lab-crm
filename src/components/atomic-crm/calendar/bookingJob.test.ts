import { describe, expect, it } from "vitest";

import type { DealPackageLine } from "../types";
import { jobPatchForBooking, likelyJob, newJobForBooking } from "./bookingJob";

const NOW = new Date("2026-10-29T20:00:00Z");
const tint: DealPackageLine = {
  package_id: 4,
  title: "Ceramic tint, crew cab",
  price: 450,
  quantity: 1,
  kind: "part",
};
const lightBar: DealPackageLine = {
  package_id: 9,
  title: "Light bar",
  price: 200,
  quantity: 2,
  kind: "part",
};

describe("jobPatchForBooking", () => {
  it("adds the booked products to the job's quote and moves a quoted job to Booked", () => {
    const patch = jobPatchForBooking(
      { stage: "quoted", packages: [tint] },
      [lightBar],
      NOW,
    );

    expect(patch.packages).toEqual([tint, lightBar]);
    expect(patch.amount).toBe(850);
    expect(patch.stage).toBe("booked");
    expect(patch.stage_changed_at).toBe(NOW.toISOString());
  });

  it("leaves a job already past Booked where it is", () => {
    const patch = jobPatchForBooking({ stage: "won", packages: [] }, [tint]);

    expect(patch.stage).toBeUndefined();
    expect(patch.amount).toBe(450);
  });
});

describe("newJobForBooking", () => {
  it("makes a Booked job named after the service, priced from the products", () => {
    const job = newJobForBooking({
      title: "  Tint and light bar ",
      contactId: 3,
      companyId: null,
      vehicleId: 12,
      salesId: 1,
      day: "2026-11-02",
      lines: [tint, lightBar],
      now: NOW,
    });

    expect(job).toMatchObject({
      name: "Tint and light bar",
      contact_ids: [3],
      vehicle_id: 12,
      stage: "booked",
      amount: 850,
      expected_closing_date: "2026-11-02",
      packages: [tint, lightBar],
    });
    expect(job).not.toHaveProperty("company_id");
  });
});

describe("likelyJob", () => {
  it("picks the customer's most recently touched open job", () => {
    const id = likelyJob([
      { id: 1, stage: "quoted", updated_at: "2026-10-01T00:00:00Z" },
      { id: 2, stage: "won", updated_at: "2026-10-28T00:00:00Z" },
      { id: 3, stage: "intake", updated_at: "2026-10-20T00:00:00Z" },
      {
        id: 4,
        stage: "qualified",
        updated_at: "2026-10-27T00:00:00Z",
        archived_at: "2026-10-27T00:00:00Z",
      },
    ]);

    expect(id).toBe(3);
  });

  it("finds nothing when every job is closed", () => {
    expect(
      likelyJob([{ id: 1, stage: "lost", updated_at: "2026-10-01T00:00:00Z" }]),
    ).toBeNull();
  });
});
