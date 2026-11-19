// Referral scoreboard rows, as the referral_months and referral_lines views
// return them, and the small sums the Referrals tab shows.

export interface ReferralMonth {
  id: string;
  program_code: string;
  /** First day of the month, "2026-11-01" */
  month: string;
  leads: number;
  quotes: number;
  open_checkouts: number;
  full_kits: number;
  half_kits: number;
  earned: number;
  monthly_cap: number;
  refunds: number;
  owed: number;
}

export interface ReferralLine {
  id: string;
  program_code: string;
  month: string;
  kind: "earned" | "refund";
  order_id: number;
  order_number: string;
  ordered_at: string;
  contact_id: number | null;
  customer: string | null;
  keyword: string | null;
  credited_by: "link" | "customer" | "claim";
  roles: string[];
  rule: string;
  full_kit: boolean;
  amount: number;
}

export interface ReferralProgram {
  id: number;
  code: string;
  name: string;
  monthly_cap: number;
  window_days: number;
  refund_days: number;
  active: boolean;
}

export interface ReferralRule {
  id: number;
  program_code: string;
  label: string;
  needs: string[];
  amount: number;
}

export interface ReferralClaim {
  id: number;
  program_code: string;
  contact_id: number;
  deal_id: number | null;
  checkout_token: string | null;
  note: string | null;
  claimed_by: string | null;
  claimed_at: string;
}

export interface KeywordRow {
  keyword: string;
  fullKits: number;
  halfKits: number;
  amount: number;
}

/** Paid kits and commission per link keyword, biggest earner first. */
export const keywordRows = (lines: ReferralLine[]): KeywordRow[] => {
  const byKeyword = new Map<string, KeywordRow>();
  for (const line of lines) {
    const keyword = line.keyword || "(no keyword)";
    const row = byKeyword.get(keyword) ?? {
      keyword,
      fullKits: 0,
      halfKits: 0,
      amount: 0,
    };
    if (line.kind === "earned") {
      if (line.full_kit) row.fullKits += 1;
      else row.halfKits += 1;
    }
    row.amount += Number(line.amount);
    byKeyword.set(keyword, row);
  }
  return [...byKeyword.values()].sort((a, b) => b.amount - a.amount);
};

/** "2026-11-01" -> "November 2026" */
export const monthLabel = (month: string): string =>
  new Date(`${month.slice(0, 10)}T12:00:00`).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  });

/** "tune, exhaust" typed in the rules editor -> ["tune", "exhaust"] */
export const parseRoles = (text: string): string[] => [
  ...new Set(
    text
      .split(/[,+\s]+/)
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean),
  ),
];
