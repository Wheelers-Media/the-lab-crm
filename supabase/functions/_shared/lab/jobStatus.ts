// What a customer may see about their job on the public status page. Pure:
// the job_status function loads the rows, this decides what is safe to show.
// Prices of individual lines, notes, phone numbers and the contact's other
// jobs never leave the CRM; only the service names, the progress, the next
// appointment and what is due.

export type StatusStep =
  | "received"
  | "booked"
  | "in_shop"
  | "ready"
  | "picked_up";

export type StatusDeal = {
  name: string;
  stage: string;
  work_status: string | null;
  packages: unknown;
  checkout: unknown;
  updated_at: string;
};

export type StatusAppointment = {
  start_at: string;
  end_at: string;
  resource: string;
  status: string;
};

export type JobStatus = {
  firstName: string;
  vehicle: string;
  services: string[];
  step: StatusStep;
  waitingOnParts: boolean;
  appointment: { startAt: string; endAt: string; resource: string } | null;
  balance: {
    dueNow: number;
    dueAtPickup: number;
    url: string;
    mode: "parts" | "all";
  } | null;
};

const servicesOf = (deal: StatusDeal): string[] => {
  const titles = (Array.isArray(deal.packages) ? deal.packages : [])
    .map((p) => String((p as { title?: unknown })?.title ?? "").trim())
    .filter(Boolean);
  const unique = [...new Set(titles)];
  // A job with no priced lines is named "Service - 2022 Ram 3500"
  return unique.length ? unique : [deal.name.split(" - ")[0].trim()];
};

const stepOf = (
  deal: StatusDeal,
  hasAppointment: boolean,
): { step: StatusStep; waitingOnParts: boolean } => {
  switch (deal.work_status) {
    case "picked_up":
      return { step: "picked_up", waitingOnParts: false };
    case "ready":
      return { step: "ready", waitingOnParts: false };
    case "in_shop":
      return { step: "in_shop", waitingOnParts: false };
    case "waiting_parts":
      return { step: "in_shop", waitingOnParts: true };
  }
  const booked =
    deal.stage === "booked" || deal.stage === "won" || hasAppointment;
  return { step: booked ? "booked" : "received", waitingOnParts: false };
};

const balanceOf = (checkout: unknown, step: StatusStep) => {
  const c = (checkout ?? {}) as Record<string, unknown>;
  const url = typeof c.url === "string" ? c.url : "";
  // Only a real https link, and nothing left to pay once the vehicle is home
  if (!url.startsWith("https://") || step === "picked_up") return null;
  return {
    dueNow: Number(c.due_now) || 0,
    dueAtPickup: Number(c.due_at_pickup) || 0,
    url,
    mode: c.mode === "parts" ? ("parts" as const) : ("all" as const),
  };
};

export const buildJobStatus = (input: {
  deal: StatusDeal;
  firstName: string | null;
  vehicle: string | null;
  appointments: StatusAppointment[];
  now?: Date;
}): JobStatus => {
  const now = (input.now ?? new Date()).getTime();
  const upcoming = input.appointments
    .filter(
      (a) =>
        a.status !== "cancelled" &&
        a.status !== "no_show" &&
        new Date(a.end_at).getTime() > now,
    )
    .sort((a, b) => a.start_at.localeCompare(b.start_at))[0];
  const { step, waitingOnParts } = stepOf(input.deal, Boolean(upcoming));
  return {
    firstName: input.firstName?.trim() ?? "",
    vehicle: input.vehicle?.trim() ?? "",
    services: servicesOf(input.deal),
    step,
    waitingOnParts,
    // Once the vehicle is at the shop the drop-off time is history
    appointment:
      upcoming && (step === "booked" || step === "received")
        ? {
            startAt: upcoming.start_at,
            endAt: upcoming.end_at,
            resource: upcoming.resource,
          }
        : null,
    balance: balanceOf(input.deal.checkout, step),
  };
};
