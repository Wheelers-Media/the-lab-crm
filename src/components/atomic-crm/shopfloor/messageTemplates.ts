// Ready-to-send texts for the moments a customer is waiting on the shop.
// They open the phone's own Messages app with the text filled in, so nothing
// is sent until a person taps send.
import type { Deal, DealCheckout, WorkStatus } from "../types";

export const SHOP_PHONE = "(250) 261-9502";

/** Opens the Google review form for the shop. */
export const REVIEW_LINK = "https://g.page/r/CdFTDo4OpyDzEAE/review";

export type TemplateId =
  | "ready"
  | "parts"
  | "status"
  | "followup"
  | "quote"
  | "deposit"
  | "review";

/** The customer's private status page; the token comes from the job. */
export const statusLink = (token?: string | null): string | null =>
  token ? `https://thelabfsj.ca/status/?t=${token}` : null;

export interface TextContext {
  firstName?: string | null;
  /** "2022 Ram 3500", when the job has a vehicle. */
  vehicle?: string | null;
  /** The job's name, "Ceramic tint, crew cab truck". */
  job?: string | null;
  checkout?: DealCheckout | null;
  /** The customer's status page link, when the job has one. */
  statusUrl?: string | null;
}

export interface TextTemplate {
  id: TemplateId;
  label: string;
  /** Null when the text makes no sense for this job (no checkout link yet). */
  build: (c: TextContext) => string | null;
}

const hello = (c: TextContext) => `Hi ${c.firstName?.trim() || "there"},`;
const what = (c: TextContext) => c.vehicle?.trim() || "vehicle";
const job = (c: TextContext) => c.job?.trim() || what(c);

// Added to a text so the customer can follow the job themselves
const follow = (c: TextContext) =>
  c.statusUrl
    ? `

Follow your job any time: ${c.statusUrl}`
    : "";

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

export const TEXT_TEMPLATES: TextTemplate[] = [
  {
    id: "ready",
    label: "Ready for pickup",
    build: (c) =>
      `${hello(c)} your ${what(c)} is ready for pickup at THE LAB. We're open Monday to Friday, 9 a.m. to 5 p.m. Text or call ${SHOP_PHONE} to let us know when you're coming.${follow(c)}`,
  },
  {
    id: "parts",
    label: "Still waiting on parts",
    build: (c) =>
      `${hello(c)} a quick update on your ${job(c)}: we're still waiting on parts. We'll text you as soon as they arrive.${follow(c)}`,
  },
  {
    id: "status",
    label: "Send the job status link",
    build: (c) =>
      c.statusUrl
        ? `${hello(c)} here is a private link to follow your ${job(c)}: ${c.statusUrl}

It shows where it's at, your drop-off time and what's due. No login needed.`
        : null,
  },
  {
    id: "followup",
    label: "Check in on the quote",
    build: (c) =>
      `${hello(c)} just checking in on the quote for your ${job(c)}. Any questions, or would you like to get a time booked? Text or call ${SHOP_PHONE} any time.`,
  },
  {
    id: "quote",
    label: "Send the pay link",
    build: (c) => {
      if (!c.checkout?.url) return null;
      const covers =
        c.checkout.mode === "parts"
          ? `It covers the parts (${money(c.checkout.due_now)}) so we can order them. The labour is paid when you pick up.`
          : `It covers everything (${money(c.checkout.due_now)}).`;
      return `${hello(c)} here is the secure link to pay for your ${job(c)}: ${c.checkout.url}\n\n${covers}`;
    },
  },
  {
    id: "deposit",
    label: "Deposit reminder",
    build: (c) =>
      `${hello(c)} we haven't received the $50 booking deposit for your ${job(c)} yet. It holds your spot and comes off your final bill. Call or text ${SHOP_PHONE} if you need a hand.`,
  },
  {
    id: "review",
    label: "Ask for a review",
    build: (c) =>
      `${hello(c)} thanks for choosing THE LAB! If you're happy with the work on your ${what(c)}, a quick Google review helps us a lot: ${REVIEW_LINK}

Thank you!`,
  },
];

// The text that fits where the vehicle is comes first
const LEAD: Partial<Record<WorkStatus, TemplateId>> = {
  ready: "ready",
  waiting_parts: "parts",
  picked_up: "review",
};

/** The texts that apply to this job, the most fitting first. */
export const templatesFor = (
  deal: Pick<Deal, "work_status" | "checkout" | "status_token"> &
    Partial<Pick<Deal, "stage">>,
  ctx: TextContext,
): Array<{ id: TemplateId; label: string; body: string }> => {
  // A quote nobody has answered is what the follow-up text is for
  const lead: TemplateId | undefined = deal.work_status
    ? LEAD[deal.work_status]
    : deal.stage === "quoted"
      ? "followup"
      : undefined;
  return TEXT_TEMPLATES.map((t) => ({
    id: t.id,
    label: t.label,
    body: t.build({
      ...ctx,
      checkout: ctx.checkout ?? deal.checkout,
      statusUrl: ctx.statusUrl ?? statusLink(deal.status_token),
    }),
  }))
    .filter((t): t is { id: TemplateId; label: string; body: string } =>
      Boolean(t.body),
    )
    .sort((a, b) => Number(b.id === lead) - Number(a.id === lead));
};

/**
 * A link that opens Messages with the text filled in. iPhones want "&body=",
 * Android wants "?body=".
 */
export const smsHref = (
  phone: string,
  body: string,
  userAgent: string = typeof navigator === "undefined"
    ? ""
    : navigator.userAgent,
): string => {
  const number = phone.replace(/[^\d+]/g, "");
  const apple = /iPhone|iPad|iPod|Macintosh/.test(userAgent);
  return `sms:${number}${apple ? "&" : "?"}body=${encodeURIComponent(body)}`;
};
