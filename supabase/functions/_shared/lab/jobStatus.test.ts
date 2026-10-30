import { describe, expect, it } from "vitest";
import { buildJobStatus, type StatusDeal } from "./jobStatus";

const now = new Date("2026-11-02T16:00:00Z");
const deal = (over: Partial<StatusDeal> = {}): StatusDeal => ({
  name: "Ceramic tint - 2022 Ram 3500",
  stage: "booked",
  work_status: null,
  packages: [],
  checkout: null,
  updated_at: "2026-11-01T00:00:00Z",
  ...over,
});
const status = (d: StatusDeal, appointments = [] as never[]) =>
  buildJobStatus({
    deal: d,
    firstName: " Jamie ",
    vehicle: "2022 Ram 3500",
    appointments,
    now,
  });
const appt = (over = {}) => ({
  start_at: "2026-11-04T16:00:00Z",
  end_at: "2026-11-04T20:00:00Z",
  resource: "detailing-bay",
  status: "booked",
  ...over,
});

describe("buildJobStatus", () => {
  it("shows a booked job with its next appointment", () => {
    const s = status(deal(), [appt()] as never[]);
    expect(s.step).toBe("booked");
    expect(s.firstName).toBe("Jamie");
    expect(s.appointment?.startAt).toBe("2026-11-04T16:00:00Z");
  });

  it("ignores cancelled and past appointments", () => {
    const s = status(deal({ stage: "quoted" }), [
      appt({ status: "cancelled" }),
      appt({
        end_at: "2026-10-01T00:00:00Z",
        start_at: "2026-10-01T00:00:00Z",
      }),
    ] as never[]);
    expect(s.step).toBe("received");
    expect(s.appointment).toBeNull();
  });

  it("calls waiting on parts 'in the shop' and says so", () => {
    const s = status(deal({ work_status: "waiting_parts" }));
    expect(s.step).toBe("in_shop");
    expect(s.waitingOnParts).toBe(true);
    expect(s.appointment).toBeNull();
  });

  it("follows the shop floor through ready and picked up", () => {
    expect(status(deal({ work_status: "ready" })).step).toBe("ready");
    expect(status(deal({ work_status: "picked_up" })).step).toBe("picked_up");
  });

  it("names the services from the quote lines without their prices", () => {
    const s = status(
      deal({
        packages: [
          { title: "Ceramic tint", price: 650, quantity: 1 },
          { title: "Ceramic tint", price: 650, quantity: 1 },
          { title: "Windshield strip", price: 99, quantity: 1 },
        ],
      }),
    );
    expect(s.services).toEqual(["Ceramic tint", "Windshield strip"]);
    expect(JSON.stringify(s)).not.toContain("650");
  });

  it("falls back to the job name when there are no lines", () => {
    expect(status(deal()).services).toEqual(["Ceramic tint"]);
  });

  it("offers the pay link until the vehicle is picked up, https only", () => {
    const checkout = {
      url: "https://shop.example/pay/abc",
      due_now: 400,
      due_at_pickup: 250,
      mode: "parts",
    };
    expect(status(deal({ checkout })).balance).toEqual({
      dueNow: 400,
      dueAtPickup: 250,
      url: "https://shop.example/pay/abc",
      mode: "parts",
    });
    expect(
      status(deal({ checkout, work_status: "picked_up" })).balance,
    ).toBeNull();
    expect(
      status(deal({ checkout: { ...checkout, url: "javascript:alert(1)" } }))
        .balance,
    ).toBeNull();
  });
});
