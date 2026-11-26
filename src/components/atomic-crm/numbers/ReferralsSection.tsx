import { useQueryClient } from "@tanstack/react-query";
import {
  useCreate,
  useDelete,
  useGetMany,
  useNotify,
  useUpdate,
} from "ra-core";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { money } from "../operations/format";
import { KpiTile } from "../operations/OperationsWidgets";
import type { DrillContent } from "../operations/DrillSheet";
import { shopDayKey } from "../operations/shopTime";
import { agoLabel } from "../shop/cartModel";
import { CheckoutDetail } from "../shop/CheckoutDetail";
import { summarizeLines } from "../shop/shopFormat";
import type { Deal, ShopifyCheckout } from "../types";
import {
  type KeywordRow,
  keywordRows,
  monthLabel,
  parseRoles,
  type ReferralClaim,
  type ReferralLine,
  type ReferralMonth,
  type ReferralProgram,
  type ReferralRule,
} from "./referralModel";
import { useAllRecords } from "./useAllRecords";
import type { Column } from "./widgets";
import { SectionCard, StatTable } from "./widgets";

const CREDITED_BY: Record<ReferralLine["credited_by"], string> = {
  link: "Tagged order",
  customer: "Tagged customer",
  claim: "Claim",
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

const sinceDays = (days: number) =>
  new Date(Date.now() - days * 864e5).toISOString();

interface SalesRow {
  id: number;
  user_id: string | null;
  first_name: string;
  last_name: string;
}

/**
 * Partner referrals: the monthly scoreboard (leads, quotes, open checkouts,
 * paid kits and what is owed after the cap and refunds), the commission lines
 * behind it, claims on quotes and carts a partner closed, and the rules Eric
 * edits. Commission is worked out in the database (referral_lines view).
 */
export const ReferralsSection = () => {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["numbers"] });
  const months = useAllRecords<ReferralMonth>("referral_months", {
    sort: { field: "month", order: "DESC" },
  });
  const lines = useAllRecords<ReferralLine>("referral_lines", {
    sort: { field: "ordered_at", order: "DESC" },
  });
  const programs = useAllRecords<ReferralProgram>("referral_programs");
  const rules = useAllRecords<ReferralRule>("referral_rules");
  const claims = useAllRecords<ReferralClaim>("referral_claims", {
    sort: { field: "claimed_at", order: "DESC" },
  });
  const sales = useAllRecords<SalesRow>("sales", {
    columns: ["id", "user_id", "first_name", "last_name"],
  });

  const program = programs.data?.[0];
  // The records behind the month's tiles: tagged leads and tagged carts
  const taggedDeals = useAllRecords<Deal>("deals", {
    filter: { referral_code: program?.code },
    sort: { field: "created_at", order: "DESC" },
    enabled: Boolean(program),
  });
  const taggedCarts = useAllRecords<ShopifyCheckout>("shopify_checkouts", {
    filter: { referral_code: program?.code },
    sort: { field: "checkout_updated_at", order: "DESC" },
    enabled: Boolean(program),
  });
  const [openCart, setOpenCart] = useState<ShopifyCheckout | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const month = picked ?? months.data?.[0]?.month ?? null;
  const current = months.data?.find((m) => m.month === month);
  const monthLines = useMemo(
    () => (lines.data ?? []).filter((l) => l.month === month),
    [lines.data, month],
  );

  if (months.error || programs.error)
    return (
      <p className="text-sm text-destructive">
        Could not load referrals. Try refreshing.
      </p>
    );
  if (!program)
    return (
      <p className="text-sm text-muted-foreground">
        {programs.isPending ? "Loading referrals…" : "No referral program yet."}
      </p>
    );

  const inMonth = (iso: string) =>
    month != null && shopDayKey(iso).slice(0, 7) === month.slice(0, 7);
  const leadDeals = (taggedDeals.data ?? []).filter((d) =>
    inMonth(d.created_at),
  );
  const monthCarts = (taggedCarts.data ?? []).filter(
    (c) => !c.completed_at && inMonth(c.created_at),
  );
  const earnedLines = monthLines.filter((l) => l.kind === "earned");
  const lineRow = (l: ReferralLine) => ({
    key: l.id,
    title: l.customer || `Order ${l.order_number}`,
    subtitle: `${l.rule}${l.keyword ? ` · ${l.keyword}` : ""} · order ${l.order_number} · ${shortDate(l.ordered_at)}`,
    value: money(Number(l.amount)),
    to: l.contact_id != null ? `/contacts/${l.contact_id}/show` : undefined,
  });
  const leadsDrill = (): DrillContent => ({
    title: `Leads, ${monthLabel(month ?? "")}`,
    description:
      "Jobs that started from a tagged link. Quotes are the ones that got a priced quote.",
    empty: "No tagged leads this month.",
    rows: leadDeals.map((d) => ({
      key: d.id,
      title: d.name,
      subtitle: `${d.stage}${d.quote ? " · quoted" : ""} · ${shortDate(d.created_at)}${d.referral_keyword ? ` · ${d.referral_keyword}` : ""}`,
      value: d.amount ? money(Number(d.amount)) : undefined,
      to: `/deals/${d.id}/show`,
    })),
  });
  const cartsDrill = (): DrillContent => ({
    title: `Open carts, ${monthLabel(month ?? "")}`,
    description:
      "Carts started from a tagged link and not paid. Tap one to call, text or open the cart.",
    empty: "No open tagged carts this month.",
    rows: monthCarts.map((c) => ({
      key: c.id,
      title: c.customer_name || c.email || c.phone || "Unknown customer",
      subtitle: `${summarizeLines(c.line_items, 2)} · ${agoLabel(c.checkout_updated_at)}`,
      value: money(Number(c.total)),
      onOpen: () => setOpenCart(c),
    })),
  });
  const kitsDrill = (): DrillContent => ({
    title: `Paid kits, ${monthLabel(month ?? "")}`,
    description: "Orders paid in full that earned commission.",
    empty: "No paid kits this month.",
    rows: earnedLines.map(lineRow),
  });
  const earnedDrill = (): DrillContent => ({
    title: `Earned, ${monthLabel(month ?? "")}`,
    description: `Commission before the ${money(Number(current?.monthly_cap ?? 0))} cap and before refunds.`,
    empty: "Nothing earned this month.",
    rows: earnedLines.map(lineRow),
  });
  const owedDrill = (): DrillContent => ({
    title: `Owed, ${monthLabel(month ?? "")}`,
    description:
      "Earned up to the cap, less refunds from the month before. These are the lines behind it, refunds included.",
    empty: "Nothing owed this month.",
    rows: monthLines.map((l) => ({
      ...lineRow(l),
      subtitle: `${l.kind === "refund" ? "Refund" : l.rule} · order ${l.order_number} · ${shortDate(l.ordered_at)}`,
      value: `${l.kind === "refund" ? "-" : ""}${money(Math.abs(Number(l.amount)))}`,
    })),
  });

  const salesName = (userId: string | null) => {
    const s = sales.data?.find((x) => x.user_id === userId);
    return s ? `${s.first_name} ${s.last_name}`.trim() : "Someone";
  };

  const monthColumns: Array<Column<ReferralMonth>> = [
    {
      header: "Month",
      value: (r) => r.month,
      display: (r) => monthLabel(r.month),
    },
    { header: "Leads", value: (r) => r.leads, numeric: true },
    { header: "Quotes", value: (r) => r.quotes, numeric: true },
    { header: "Open carts", value: (r) => r.open_checkouts, numeric: true },
    { header: "Full kits", value: (r) => r.full_kits, numeric: true },
    { header: "Half kits", value: (r) => r.half_kits, numeric: true },
    {
      header: "Earned",
      value: (r) => r.earned,
      display: (r) => money(Number(r.earned)),
      numeric: true,
    },
    {
      header: "Refunds",
      value: (r) => r.refunds,
      display: (r) => money(Number(r.refunds)),
      numeric: true,
    },
    {
      header: "Owed",
      value: (r) => r.owed,
      display: (r) => money(Number(r.owed)),
      numeric: true,
    },
  ];
  const lineColumns: Array<Column<ReferralLine>> = [
    {
      header: "Date",
      value: (r) => r.ordered_at,
      display: (r) => shortDate(r.ordered_at),
    },
    {
      header: "Order",
      value: (r) => r.order_number,
      display: (r) => (
        <Link className="underline" to={`/orders/${r.order_id}/show`}>
          {r.order_number}
        </Link>
      ),
    },
    { header: "Customer", value: (r) => r.customer ?? "" },
    { header: "Keyword", value: (r) => r.keyword ?? "" },
    {
      header: "Why",
      value: (r) =>
        r.kind === "refund"
          ? "Refund within window"
          : CREDITED_BY[r.credited_by],
    },
    { header: "Rule", value: (r) => r.rule },
    {
      header: "Amount",
      value: (r) => r.amount,
      display: (r) => money(Number(r.amount)),
      numeric: true,
    },
  ];
  const keywordColumns: Array<Column<KeywordRow>> = [
    { header: "Keyword", value: (r) => r.keyword },
    { header: "Full kits", value: (r) => r.fullKits, numeric: true },
    { header: "Half kits", value: (r) => r.halfKits, numeric: true },
    {
      header: "Commission",
      value: (r) => r.amount,
      display: (r) => money(r.amount),
      numeric: true,
    },
  ];

  return (
    <>
      <CheckoutDetail checkout={openCart} onClose={() => setOpenCart(null)} />
      <p className="text-sm text-muted-foreground">
        {program.name}: links with <code>?ref={program.code}</code> (or{" "}
        <code>thelabfsj.ca/{program.code}/&lt;page&gt;</code>).
      </p>
      {current ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiTile
            label="Leads"
            value={String(current.leads)}
            detail={`${current.quotes} quotes`}
            drill={leadsDrill}
          />
          <KpiTile
            label="Open carts"
            value={String(current.open_checkouts)}
            detail="tagged, not paid"
            drill={cartsDrill}
          />
          <KpiTile
            label="Paid kits"
            value={String(
              Number(current.full_kits) + Number(current.half_kits),
            )}
            detail={`${current.full_kits} full · ${current.half_kits} half`}
            drill={kitsDrill}
          />
          <KpiTile
            label="Earned"
            value={money(Number(current.earned))}
            detail={`cap ${money(Number(current.monthly_cap))}`}
            drill={earnedDrill}
          />
          <KpiTile
            label="Owed"
            value={money(Number(current.owed))}
            detail={
              Number(current.refunds)
                ? `after ${money(Number(current.refunds))} refunds`
                : monthLabel(current.month)
            }
            drill={owedDrill}
          />
        </div>
      ) : null}

      <SectionCard
        title="Month by month"
        hint="Tap a month to see its lines. Owed = earned up to the cap, less refunds from the month before."
      >
        <StatTable
          rows={months.data ?? []}
          rowKey={(r) => r.id}
          columns={monthColumns}
          filename="referrals-by-month.csv"
          limit={12}
          empty="No tagged leads or sales yet."
          onRowClick={(r) => setPicked(r.month)}
          isSelected={(r) => r.month === month}
        />
      </SectionCard>

      {month ? (
        <SectionCard
          title={`Commission lines, ${monthLabel(month)}`}
          hint="Each line names the order it came from. Paid in full only; deposits never count."
        >
          <StatTable
            rows={monthLines}
            rowKey={(r) => r.id}
            columns={lineColumns}
            filename={`referral-lines-${month}.csv`}
            limit={50}
            empty="No commission this month."
          />
        </SectionCard>
      ) : null}

      {month ? (
        <SectionCard title="By keyword" hint="Which links sell kits.">
          <StatTable
            rows={keywordRows(monthLines)}
            rowKey={(r) => r.keyword}
            columns={keywordColumns}
            empty="No paid kits this month."
          />
        </SectionCard>
      ) : null}

      <ClaimsCard
        program={program}
        claims={claims.data ?? []}
        salesName={salesName}
        onChange={refresh}
      />
      <RulesCard
        program={program}
        rules={(rules.data ?? []).filter(
          (r) => r.program_code === program.code,
        )}
        onChange={refresh}
      />
    </>
  );
};

/** Claims on old quotes and open carts a partner closed, and the buttons to make one. */
const ClaimsCard = ({
  program,
  claims,
  salesName,
  onChange,
}: {
  program: ReferralProgram;
  claims: ReferralClaim[];
  salesName: (userId: string | null) => string;
  onChange: () => void;
}) => {
  const notify = useNotify();
  const [create, { isPending }] = useCreate();
  const [remove] = useDelete();
  const deals = useAllRecords<Deal>("deals", {
    filter: { "created_at@gte": sinceDays(180) },
    sort: { field: "created_at", order: "DESC" },
  });
  const carts = useAllRecords<ShopifyCheckout>("shopify_checkouts", {
    filter: { "checkout_updated_at@gte": sinceDays(60) },
    sort: { field: "checkout_updated_at", order: "DESC" },
  });
  const claimed = new Set(claims.map((c) => c.contact_id));
  const contactIds = [...claimed];
  const { data: contacts } = useGetMany(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );
  const contactName = (id: number) => {
    const c = contacts?.find((x) => x.id === id);
    return c
      ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || `Customer ${id}`
      : `Customer ${id}`;
  };

  const openQuotes = (deals.data ?? [])
    .filter(
      (d) => !["won", "lost"].includes(d.stage) && d.contact_ids?.[0] != null,
    )
    .filter((d) => !claimed.has(Number(d.contact_ids[0])))
    .slice(0, 15);
  const openCarts = (carts.data ?? [])
    .filter(
      (c) =>
        !c.completed_at &&
        c.contact_id != null &&
        !claimed.has(Number(c.contact_id)),
    )
    .slice(0, 15);

  const claim = (data: Partial<ReferralClaim>) =>
    create(
      "referral_claims",
      { data: { program_code: program.code, ...data } },
      {
        onSuccess: () => {
          notify("Claimed. Their paid orders now count toward commission.", {
            type: "success",
          });
          onChange();
        },
        onError: () => notify("Could not save the claim.", { type: "error" }),
      },
    );

  return (
    <SectionCard
      title="Claims"
      hint={`Claim a quote or cart you closed: that customer's paid orders from a week before the claim to ${program.window_days} days after it count. Eric sees who claimed and when.`}
    >
      {claims.length ? (
        <ul className="flex flex-col gap-1 text-sm">
          {claims.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <Link className="underline" to={`/contacts/${c.contact_id}/show`}>
                {contactName(c.contact_id)}
              </Link>
              <span className="text-muted-foreground">
                claimed by {salesName(c.claimed_by)} on{" "}
                {shortDate(c.claimed_at)}
                {c.note ? `: ${c.note}` : ""}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  remove(
                    "referral_claims",
                    { id: c.id, previousData: c },
                    { onSuccess: onChange },
                  )
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No claims yet.</p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold mb-1">Open quotes</h3>
          {openQuotes.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {openQuotes.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-2"
                >
                  <Link
                    className="underline truncate"
                    to={`/deals/${d.id}/show`}
                  >
                    {d.name}
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      claim({
                        contact_id: Number(d.contact_ids[0]),
                        deal_id: Number(d.id),
                      })
                    }
                  >
                    Claim
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None open.</p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-1">Open carts</h3>
          {openCarts.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {openCarts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate">
                    {c.customer_name || c.email || "Customer"} ·{" "}
                    {money(Number(c.total))}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      claim({
                        contact_id: Number(c.contact_id),
                        checkout_token: c.checkout_token,
                      })
                    }
                  >
                    Claim
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None open.</p>
          )}
        </div>
      </div>
    </SectionCard>
  );
};

/** The program's cap, windows and payout rules, editable by Eric. */
const RulesCard = ({
  program,
  rules,
  onChange,
}: {
  program: ReferralProgram;
  rules: ReferralRule[];
  onChange: () => void;
}) => {
  const notify = useNotify();
  const [update] = useUpdate();
  const [create] = useCreate();
  const [remove] = useDelete();
  const done = {
    onSuccess: onChange,
    onError: () => notify("Could not save.", { type: "error" as const }),
  };

  const saveProgram = (
    field: "monthly_cap" | "window_days" | "refund_days",
    raw: string,
  ) => {
    const value = Number(raw);
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value === Number(program[field])
    )
      return;
    update(
      "referral_programs",
      { id: program.id, data: { [field]: value }, previousData: program },
      done,
    );
  };
  const saveRule = (rule: ReferralRule, data: Partial<ReferralRule>) =>
    update("referral_rules", { id: rule.id, data, previousData: rule }, done);

  return (
    <SectionCard
      title="Rules"
      hint="An order earns the biggest rule whose roles it holds. A product has a role when Eric tags it in Shopify: commission:tune, commission:exhaust, and so on. Untagged products never earn."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Monthly cap ($)
          <Input
            type="number"
            min={0}
            defaultValue={program.monthly_cap}
            onBlur={(e) => saveProgram("monthly_cap", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          Customer window (days)
          <Input
            type="number"
            min={1}
            defaultValue={program.window_days}
            onBlur={(e) => saveProgram("window_days", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          Refund window (days)
          <Input
            type="number"
            min={0}
            defaultValue={program.refund_days}
            onBlur={(e) => saveProgram("refund_days", e.target.value)}
          />
        </label>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {rules.map((r) => (
          <li
            key={r.id}
            className="grid grid-cols-[1fr_1fr_6rem_auto] items-center gap-2"
          >
            <Input
              aria-label="Rule name"
              defaultValue={r.label}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== r.label) saveRule(r, { label: v });
              }}
            />
            <Input
              aria-label="Roles needed"
              defaultValue={r.needs.join(" + ")}
              onBlur={(e) => {
                const needs = parseRoles(e.target.value);
                if (needs.length && needs.join() !== r.needs.join())
                  saveRule(r, { needs });
              }}
            />
            <Input
              aria-label="Amount"
              type="number"
              min={0}
              defaultValue={r.amount}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v >= 0 && v !== Number(r.amount))
                  saveRule(r, { amount: v });
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                remove("referral_rules", { id: r.id, previousData: r }, done)
              }
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            create(
              "referral_rules",
              {
                data: {
                  program_code: program.code,
                  label: "New rule",
                  needs: ["bumper"],
                  amount: 0,
                },
              },
              done,
            )
          }
        >
          Add a rule
        </Button>
      </div>
    </SectionCard>
  );
};
