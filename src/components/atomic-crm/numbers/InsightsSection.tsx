import { Fragment, type KeyboardEvent, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

import { money } from "../operations/format";
import type { Order } from "../types";
import type { LedgerOrder } from "./customerModel";
import {
  bandLabel,
  basketBands,
  HOUR_BAND,
  newVsReturning,
  ordersInSlot,
  type Pace,
  paymentStatus,
  salesPace,
  WEEKDAY_NAMES,
  weekdayHourGrid,
} from "./insightsModel";
import type { Drill } from "./OrderDrillSheet";
import type { NumbersPeriod, NumbersRanges } from "./periods";
import { percentChange } from "./salesModel";
import { Delta, SectionCard } from "./widgets";

const hourTick = (hour: number): string =>
  `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "a" : "p"}`;

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

// ── When customers buy ─────────────────────────────────────────────────────

const WhenCustomersBuy = ({
  orders,
  ranges,
  onDrill,
}: {
  orders: Order[];
  ranges: NumbersRanges;
  onDrill: (drill: Drill) => void;
}) => {
  const grid = useMemo(
    () => weekdayHourGrid(orders, ranges.current),
    [orders, ranges],
  );
  const bands = Array.from({ length: grid.bands }, (_, b) => b);
  return (
    <SectionCard
      title="When customers buy"
      hint={
        grid.busiest
          ? `Busiest: ${WEEKDAY_NAMES[grid.busiest.weekday]} ${bandLabel(grid.busiest.band)}, ${plural(grid.busiest.orders, "order", "orders")}. Shop time. Tap a square for its orders.`
          : "No orders in this period."
      }
    >
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `2.25rem repeat(${grid.bands}, minmax(0, 1fr))`,
        }}
      >
        <span />
        {bands.map((b) => (
          <span
            key={b}
            className="text-center text-[10px] text-muted-foreground lab-num"
          >
            {b % 2 === 0 ? hourTick(b * HOUR_BAND) : ""}
          </span>
        ))}
        {WEEKDAY_NAMES.map((day, weekday) => (
          <Fragment key={day}>
            <span className="self-center text-xs text-muted-foreground">
              {day}
            </span>
            {bands.map((band) => {
              const cell = grid.cells[weekday * grid.bands + band];
              const strength = grid.max ? cell.orders / grid.max : 0;
              const text = `${day} ${bandLabel(band)}: ${plural(cell.orders, "order", "orders")}, ${money(cell.netSales)}`;
              return (
                <button
                  key={band}
                  type="button"
                  disabled={!cell.orders}
                  title={text}
                  aria-label={text}
                  onClick={() =>
                    onDrill({
                      title: `${day} ${bandLabel(band)}`,
                      hint: "Every order at that time in this period.",
                      orders: ordersInSlot(
                        orders,
                        ranges.current,
                        weekday,
                        band,
                      ),
                    })
                  }
                  className="h-8 rounded-[3px] bg-muted/50 disabled:cursor-default enabled:hover:ring-2 enabled:hover:ring-foreground"
                  style={
                    cell.orders
                      ? {
                          background: `color-mix(in oklab, var(--lab-blue) ${Math.round(18 + strength * 72)}%, transparent)`,
                        }
                      : undefined
                  }
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </SectionCard>
  );
};

// ── How the month is pacing ────────────────────────────────────────────────

const W = 600;
const H = 200;
const PAD = { left: 8, right: 8, top: 10, bottom: 8 };

const PaceChart = ({ pace }: { pace: Pace }) => {
  const last = pace.daysElapsed - 1;
  const [hover, setHover] = useState<number | null>(null);
  const n = pace.points.length;
  const index = Math.min(n - 1, hover ?? Math.max(0, last));
  const max = Math.max(1, pace.previousTotal, pace.projected ?? 0, pace.soFar);
  const x = (i: number) =>
    PAD.left + (i / Math.max(1, n - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    H - PAD.bottom - (v / max) * (H - PAD.top - PAD.bottom);
  const path = (values: Array<number | null>) =>
    values
      .map((v, i) =>
        v == null
          ? null
          : `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`,
      )
      .filter(Boolean)
      .join(" ");
  const current = path(pace.points.map((p) => p.current));
  const previous = path(pace.points.map((p) => p.previous));
  const projection =
    pace.projected != null && last >= 0
      ? `M${x(last).toFixed(1)},${y(pace.soFar).toFixed(1)} L${x(n - 1).toFixed(1)},${y(pace.projected).toFixed(1)}`
      : null;
  const point = pace.points[index];

  const fromPointer = (clientX: number, el: SVGSVGElement) => {
    const rect = el.getBoundingClientRect();
    const frac = (clientX - rect.left) / rect.width;
    setHover(Math.min(n - 1, Math.max(0, Math.round(frac * (n - 1)))));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight") setHover(Math.min(n - 1, index + 1));
    else if (e.key === "ArrowLeft") setHover(Math.max(0, index - 1));
    else return;
    e.preventDefault();
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm lab-num min-h-5" aria-live="polite">
        <span className="text-muted-foreground">{point.label}: </span>
        {point.current != null ? (
          <>
            {money(point.current)}
            <span className="text-muted-foreground"> this period, </span>
          </>
        ) : null}
        {money(point.previous)}
        <span className="text-muted-foreground"> last period</span>
      </p>
      {/* The lines stretch to the card's width; the dots are HTML so the
          stretch does not squash them into ovals */}
      <div className="relative h-48 w-full sm:h-56">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          role="img"
          aria-label="Running net sales this period against the period before"
          tabIndex={0}
          onPointerMove={(e) => fromPointer(e.clientX, e.currentTarget)}
          onPointerDown={(e) => fromPointer(e.clientX, e.currentTarget)}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
        >
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(max * f)}
              y2={y(max * f)}
              stroke="var(--color-border)"
              strokeOpacity={0.6}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={H - PAD.bottom}
            y2={H - PAD.bottom}
            stroke="var(--color-border)"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={previous}
            fill="none"
            stroke="var(--chart-compare)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          {projection ? (
            <path
              d={projection}
              fill="none"
              stroke="var(--chart-selected)"
              strokeWidth={2}
              strokeDasharray="5 5"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          <path
            d={current}
            fill="none"
            stroke="var(--chart-this)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={x(index)}
            x2={x(index)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="var(--color-muted-foreground)"
            strokeOpacity={0.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="pointer-events-none absolute right-0 top-0 text-[10px] tabular-nums text-muted-foreground">
          {money(max)}
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--chart-compare)] ring-2 ring-card"
          style={{
            left: `${(x(index) / W) * 100}%`,
            top: `${(y(point.previous) / H) * 100}%`,
          }}
        />
        {point.current != null ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--chart-this)] ring-2 ring-card"
            style={{
              left: `${(x(index) / W) * 100}%`,
              top: `${(y(point.current) / H) * 100}%`,
            }}
          />
        ) : null}
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-0.5 w-4 rounded-full bg-[var(--chart-this)]"
            aria-hidden="true"
          />
          This period
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-0.5 w-4 rounded-full bg-[var(--chart-compare)]"
            aria-hidden="true"
          />
          Period before
        </span>
        {projection ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-4 border-t-2 border-dashed border-[var(--chart-selected)]"
              aria-hidden="true"
            />
            At this pace
          </span>
        ) : null}
      </p>
    </div>
  );
};

const PaceCard = ({ pace }: { pace: Pace }) => {
  const vsPrevious = percentChange(pace.soFar, pace.previousToDate);
  return (
    <SectionCard
      title="Sales pace"
      hint={`Day ${pace.daysElapsed} of ${pace.daysTotal}. Net sales so far against the same stretch before. Drag or tap along the line; arrow keys work too.`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">So far</p>
          <p className="text-xl font-semibold lab-num">{money(pace.soFar)}</p>
          <p className="text-xs text-muted-foreground lab-num">
            <Delta value={vsPrevious} /> vs {money(pace.previousToDate)} by now
            last period
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">At this pace</p>
          <p className="text-xl font-semibold lab-num">
            {pace.projected == null ? "–" : money(pace.projected)}
          </p>
          <p className="text-xs text-muted-foreground">
            Today's daily average carried to the end. A guide, not a promise.
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Last period in full</p>
          <p className="text-xl font-semibold lab-num">
            {money(pace.previousTotal)}
          </p>
          <p className="text-xs text-muted-foreground lab-num">
            {pace.projected != null && pace.previousTotal > 0 ? (
              <>
                <Delta
                  value={percentChange(pace.projected, pace.previousTotal)}
                />{" "}
                projected
              </>
            ) : null}
          </p>
        </div>
      </div>
      <PaceChart pace={pace} />
    </SectionCard>
  );
};

// ── Order size, payment status, new vs returning ───────────────────────────

const OrderSize = ({
  orders,
  ranges,
  onDrill,
}: {
  orders: Order[];
  ranges: NumbersRanges;
  onDrill: (drill: Drill) => void;
}) => {
  const bands = useMemo(
    () => basketBands(orders, ranges.current),
    [orders, ranges],
  );
  return (
    <SectionCard
      title="Order size"
      hint="How many orders land in each size, by net value. Tap a row for its orders."
    >
      <ul className="flex flex-col gap-1">
        {bands.map((b) => (
          <li key={b.label}>
            <button
              type="button"
              disabled={!b.orders}
              onClick={() => onDrill({ title: b.label, orders: b.list })}
              className="w-full rounded-md px-1 py-1.5 text-left enabled:hover:bg-muted disabled:cursor-default"
            >
              <span className="flex items-baseline justify-between gap-2 text-sm">
                <span>{b.label}</span>
                <span className="lab-num text-muted-foreground">
                  {plural(b.orders, "order", "orders")}, {money(b.netSales)}
                </span>
              </span>
              <span className="mt-1 block h-2 rounded-full bg-muted">
                <span
                  className="block h-2 rounded-full bg-primary"
                  style={{ width: `${b.share}%` }}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
};

const PaymentStatus = ({
  orders,
  ranges,
  onDrill,
}: {
  orders: Order[];
  ranges: NumbersRanges;
  onDrill: (drill: Drill) => void;
}) => {
  const rows = useMemo(
    () => paymentStatus(orders, ranges.current),
    [orders, ranges],
  );
  return (
    <SectionCard
      title="Payment status"
      hint="Where each order stands. Money not yet in is first. Booking deposits are left out."
    >
      {rows.length ? (
        <ul className="flex flex-col gap-1">
          {rows.map((r) => (
            <li key={r.name}>
              <button
                type="button"
                onClick={() => onDrill({ title: r.name, orders: r.list })}
                className="flex w-full items-baseline justify-between gap-2 rounded-md px-1 py-2 text-left text-sm hover:bg-muted"
              >
                <span
                  className={cn(
                    r.open && "font-medium text-[var(--lab-amber)]",
                  )}
                >
                  {r.name}
                </span>
                <span className="lab-num text-muted-foreground">
                  {plural(r.orders, "order", "orders")}, {money(r.amount)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing in this period.</p>
      )}
    </SectionCard>
  );
};

/**
 * New customers stacked under returning ones, per day, week or month. Thin
 * columns with a gap between the two parts, a readout of the one under the
 * finger, and dates along the bottom so a bar can be placed in time.
 */
const NewReturningBars = ({
  mix,
}: {
  mix: Array<{
    key: string;
    label: string;
    newCustomers: number;
    returning: number;
  }>;
}) => {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...mix.map((m) => m.newCustomers + m.returning));
  const shown = active != null ? mix[active] : null;
  const step = Math.max(1, Math.ceil(mix.length / 7));
  return (
    <div className="flex flex-col gap-2">
      <p className="min-h-5 text-sm tabular-nums" aria-live="polite">
        {shown ? (
          <>
            <span className="text-muted-foreground">{shown.label}: </span>
            {shown.newCustomers} new
            <span className="text-muted-foreground"> · </span>
            {shown.returning} returning
          </>
        ) : (
          <span className="text-muted-foreground">
            Tap or hover a bar for its numbers.
          </span>
        )}
      </p>
      <div
        className="relative h-40"
        role="img"
        aria-label={mix
          .map(
            (m) =>
              `${m.label}: ${m.newCustomers} new, ${m.returning} returning`,
          )
          .join("; ")}
        onPointerLeave={() => setActive(null)}
      >
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2].map((g) => (
            <span key={g} className="h-px w-full bg-border/60" />
          ))}
        </div>
        <span className="pointer-events-none absolute -top-0.5 right-0 bg-card pl-1 text-[10px] tabular-nums text-muted-foreground">
          {max}
        </span>
        <div className="absolute inset-0 flex items-end gap-px">
          {mix.map((m, i) => (
            <div
              key={m.key}
              onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)}
              className={cn(
                "flex h-full min-w-0 flex-1 flex-col justify-end transition-opacity",
                active != null && active !== i && "opacity-45",
              )}
            >
              <div className="mx-auto flex w-full max-w-6 flex-col gap-[2px]">
                {m.returning ? (
                  <span
                    className="block w-full rounded-t-[4px] bg-[var(--viz-2)]"
                    style={{ height: `${(m.returning / max) * 160}px` }}
                  />
                ) : null}
                {m.newCustomers ? (
                  <span
                    className={cn(
                      "block w-full bg-[var(--viz-1)]",
                      !m.returning && "rounded-t-[4px]",
                    )}
                    style={{ height: `${(m.newCustomers / max) * 160}px` }}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-px text-[10px] text-muted-foreground">
        {mix.map((m, i) => (
          <span
            key={m.key}
            className="min-w-0 flex-1 whitespace-nowrap text-center"
          >
            {i % step === 0 ? m.label : ""}
          </span>
        ))}
      </div>
      <p className="flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-[var(--viz-1)]" /> New
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-[var(--viz-2)]" />{" "}
          Returning
        </span>
      </p>
    </div>
  );
};

const NewVsReturning = ({
  ledgerOrders,
  ranges,
  segmentActive,
}: {
  ledgerOrders: LedgerOrder[];
  ranges: NumbersRanges;
  segmentActive: boolean;
}) => {
  const mix = useMemo(
    () => newVsReturning(ledgerOrders, ranges),
    [ledgerOrders, ranges],
  );
  const fresh = mix.reduce((s, m) => s + m.newCustomers, 0);
  const back = mix.reduce((s, m) => s + m.returning, 0);
  return (
    <SectionCard
      title="New and returning customers"
      hint={`${fresh} first-time and ${back} repeat customer visits, by ${ranges.bucket}. ${segmentActive ? "Shows every customer; the filter above does not apply here. " : ""}`}
    >
      <NewReturningBars mix={mix} />
    </SectionCard>
  );
};

/** Patterns in the orders: when they come, how big they are, who they are from. */
export const InsightsSection = ({
  orders,
  ledgerOrders,
  ranges,
  period,
  now,
  segmentActive,
  onDrill,
}: {
  orders: Order[];
  ledgerOrders: LedgerOrder[];
  ranges: NumbersRanges;
  period: NumbersPeriod;
  now: Date;
  segmentActive: boolean;
  onDrill: (drill: Drill) => void;
}) => {
  const pace = useMemo(
    () => salesPace(orders, period, now),
    [orders, period, now],
  );
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {pace ? (
        <div className="lg:col-span-2">
          <PaceCard pace={pace} />
        </div>
      ) : null}
      <div className="lg:col-span-2">
        <WhenCustomersBuy orders={orders} ranges={ranges} onDrill={onDrill} />
      </div>
      <OrderSize orders={orders} ranges={ranges} onDrill={onDrill} />
      <PaymentStatus orders={orders} ranges={ranges} onDrill={onDrill} />
      <div className="lg:col-span-2">
        <NewVsReturning
          ledgerOrders={ledgerOrders}
          ranges={ranges}
          segmentActive={segmentActive}
        />
      </div>
    </div>
  );
};
