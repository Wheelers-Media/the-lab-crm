// What to offer a customer next, worked out from what they have bought, what
// is booked and what is quoted. Plain records in, a short ranked list out, so
// the rules can be read (and tested) without a database.
//
// The rules are deliberately few and explainable: every suggestion says why it
// is there, in the customer's own history, so Eric can trust it or ignore it.
import type { Identifier } from "ra-core";

import { orderKinds, type ServiceKind } from "../operations/serviceKinds";
import type { Appointment, Deal, Order } from "../types";

export type NextSaleAction = "quote" | "book" | "text" | "open-quote";

export interface NextSale {
  id:
    | "membership"
    | "membership-lapsed"
    | "quote-follow-up"
    | "detail-due"
    | "win-back"
    | "tint"
    | "detail"
    | "tune"
    | "first-job";
  title: string;
  /** Why, in one sentence from the customer's own history. */
  reason: string;
  action: NextSaleAction;
  /** The job to open, for a quote follow-up. */
  dealId?: Identifier;
}

export interface NextSaleInput {
  orders: Order[];
  appointments: Appointment[];
  deals: Deal[];
  /** Membership set on the profile ("monthly-signature", ...). */
  membership?: string | null;
  /** The membership's catalog price, to say what it costs. */
  membershipPrice?: number | null;
  now?: Date;
}

const DAY_MS = 86_400_000;

/** Two or more details in this window makes the monthly membership worth offering. */
export const MEMBERSHIP_WINDOW_DAYS = 90;
export const MEMBERSHIP_MIN_DETAILS = 2;
/** A detail every two months or so is the rhythm; past this, they are due. */
export const DETAIL_DUE_DAYS = 60;
/** Past this, a detail customer is a win-back, not a reminder. */
const DETAIL_DUE_MAX_DAYS = 365;
export const WIN_BACK_DAYS = 180;
/** A quote with no answer for this long needs a nudge. */
export const QUOTE_FOLLOW_UP_DAYS = 3;
const MEMBERSHIP_GRACE_DAYS = 35;
export const MAX_SUGGESTIONS = 3;

const isSale = (o: Order): boolean => !o.cancelled_at && !o.is_deposit;

const daysSince = (iso: string, now: Date): number =>
  Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS);

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const money = (n: number): string =>
  n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

const plural = (n: number, one: string, many: string): string =>
  `${n} ${n === 1 ? one : many}`;

const orderNet = (o: Order): number =>
  Math.max(0, (Number(o.total) || 0) - (Number(o.refunded_amount) || 0));

/**
 * Up to three things to offer next, the most valuable first. Nothing is
 * suggested twice, and nothing that is already booked or quoted.
 */
export const nextSales = ({
  orders,
  appointments,
  deals,
  membership,
  membershipPrice,
  now = new Date(),
}: NextSaleInput): NextSale[] => {
  const sales = orders
    .filter(isSale)
    .sort((a, b) => b.ordered_at.localeCompare(a.ordered_at));
  const withKind = (kind: ServiceKind) =>
    sales.filter((o) => orderKinds(o).has(kind));
  const details = withKind("detail");
  const memberships = withKind("membership");
  const ever = (kind: ServiceKind) => withKind(kind).length > 0;

  const upcoming = appointments.some(
    (a) =>
      (a.status === "booked" || a.status === "rescheduled") &&
      new Date(a.start_at).getTime() > now.getTime(),
  );
  const openDeals = deals.filter(
    (d) => !d.archived_at && d.stage !== "won" && d.stage !== "lost",
  );
  const lastMembershipPaid = memberships[0]?.ordered_at;
  const isMember =
    !!membership ||
    (lastMembershipPaid != null &&
      daysSince(lastMembershipPaid, now) <= MEMBERSHIP_GRACE_DAYS);

  const out: Array<NextSale & { rank: number }> = [];

  // A quote with no answer is money on the table: chase it first
  const waiting = openDeals
    .filter(
      (d) =>
        d.stage === "quoted" &&
        daysSince(d.stage_changed_at ?? d.updated_at, now) >=
          QUOTE_FOLLOW_UP_DAYS,
    )
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))[0];
  if (waiting) {
    const days = daysSince(waiting.stage_changed_at ?? waiting.updated_at, now);
    out.push({
      id: "quote-follow-up",
      title: "Follow up on the quote",
      reason: `${waiting.name}${Number(waiting.amount) ? `, ${money(Number(waiting.amount))}` : ""}, quoted ${plural(days, "day", "days")} ago with no answer.`,
      action: "open-quote",
      dealId: waiting.id,
      rank: 100,
    });
  }

  // Regular detail customers are the membership's whole market
  const recentDetails = details.filter(
    (o) => daysSince(o.ordered_at, now) <= MEMBERSHIP_WINDOW_DAYS,
  );
  if (!isMember && recentDetails.length >= MEMBERSHIP_MIN_DETAILS) {
    const spent = recentDetails.reduce((s, o) => s + orderNet(o), 0);
    out.push({
      id: "membership",
      title: "Offer The Monthly Signature",
      reason:
        `${plural(recentDetails.length, "detail", "details")} in the last 3 months (${money(spent)}). ` +
        (membershipPrice
          ? `The membership is ${money(membershipPrice)} a month and books them in every month.`
          : "The membership books them in every month."),
      action: "quote",
      rank: 95,
    });
  } else if (!membership && lastMembershipPaid && !isMember) {
    out.push({
      id: "membership-lapsed",
      title: "Win back their membership",
      reason: `Last membership payment ${shortDate(lastMembershipPaid)}. Ask what would bring them back.`,
      action: "text",
      rank: 90,
    });
  }

  const lastDetail = details[0]?.ordered_at;
  const lastSale = sales[0]?.ordered_at;
  if (!upcoming && !isMember && lastDetail) {
    const days = daysSince(lastDetail, now);
    if (days >= DETAIL_DUE_DAYS && days < DETAIL_DUE_MAX_DAYS) {
      out.push({
        id: "detail-due",
        title: "Due for a detail",
        reason: `Last detail ${shortDate(lastDetail)}, ${plural(days, "day", "days")} ago.`,
        action: "book",
        rank: 80,
      });
    }
  }
  if (!upcoming && lastSale && daysSince(lastSale, now) >= WIN_BACK_DAYS) {
    const months = Math.floor(daysSince(lastSale, now) / 30);
    out.push({
      id: "win-back",
      title: "Check in",
      reason: `Nothing bought in ${plural(months, "month", "months")} (last ${shortDate(lastSale)}).`,
      action: "text",
      rank: 70,
    });
  }

  // Cross-sells: the next service people like them usually buy
  if (ever("detail") && !ever("tint")) {
    out.push({
      id: "tint",
      title: "Offer ceramic tint",
      reason: "They keep the truck clean with us but have never had it tinted.",
      action: "quote",
      rank: 50,
    });
  }
  if (!ever("detail") && (ever("tint") || ever("lighting") || ever("parts"))) {
    out.push({
      id: "detail",
      title: "Offer a Signature detail",
      reason: "They buy upgrades from us but have never had a detail.",
      action: "quote",
      rank: 45,
    });
  }
  if (ever("parts") && !ever("tune")) {
    out.push({
      id: "tune",
      title: "Offer a tune",
      reason: "They have bought diesel parts but no tune to match.",
      action: "quote",
      rank: 40,
    });
  }

  if (!sales.length && !openDeals.length) {
    out.push({
      id: "first-job",
      title: "Quote their first job",
      reason: "No purchases and no open job yet.",
      action: "quote",
      rank: 30,
    });
  }

  return out
    .sort((a, b) => b.rank - a.rank)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ rank: _rank, ...sale }) => sale);
};

/** Headline numbers for the top of a customer's profile. */
export interface CustomerSnapshot {
  lifetimeSpend: number;
  orders: number;
  /** Appointments they came in for. */
  visits: number;
  lastVisit: string | null;
  nextVisit: Appointment | null;
  noShows: number;
}

export const customerSnapshot = (
  orders: Order[],
  appointments: Appointment[],
  now: Date = new Date(),
): CustomerSnapshot => {
  const sales = orders.filter(
    (o) => isSale(o) && (o.currency ?? "CAD") === "CAD",
  );
  const t = now.getTime();
  const past = appointments.filter(
    (a) =>
      a.status === "completed" ||
      (a.status === "booked" && new Date(a.start_at).getTime() <= t),
  );
  const lastVisitAt = [
    ...past.map((a) => a.start_at),
    ...sales.map((o) => o.ordered_at),
  ]
    .sort()
    .at(-1);
  const nextVisit =
    appointments
      .filter(
        (a) =>
          (a.status === "booked" || a.status === "rescheduled") &&
          new Date(a.start_at).getTime() > t,
      )
      .sort((a, b) => a.start_at.localeCompare(b.start_at))[0] ?? null;
  return {
    lifetimeSpend: sales.reduce((s, o) => s + orderNet(o), 0),
    orders: sales.length,
    visits: past.length,
    lastVisit: lastVisitAt ?? null,
    nextVisit,
    noShows: appointments.filter((a) => a.status === "no_show").length,
  };
};
