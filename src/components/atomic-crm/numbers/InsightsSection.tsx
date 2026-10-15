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
                  className="h-8 rounded-sm border border-border disabled:cursor-default enabled:hover:border-foreground"
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
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-48 touch-pan-y"
        role="img"
        aria-label="Running net sales this period against the period before"
        tabIndex={0}
        onPointerMove={(e) => fromPointer(e.clientX, e.currentTarget)}
        onPointerDown={(e) => fromPointer(e.clientX, e.currentTarget)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
      >
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
          stroke="var(--color-border)"
        />
        <path d={previous} fill="none" stroke="#6b7686" strokeWidth={2} />
        {projection ? (
          <path
            d={projection}
            fill="none"
            stroke="#5c9dff"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
        ) : null}
        <path d={current} fill="none" stroke="#0066FF" strokeWidth={3} />
        <line
          x1={x(index)}
          x2={x(index)}
          y1={PAD.top}
          y2={H - PAD.bottom}
          stroke="var(--color-muted-foreground)"
          strokeOpacity={0.5}
        />
        {point.current != null ? (
          <circle
            cx={x(index)}
            cy={y(point.current)}
            r={4.5}
            fill="#0066FF"
            stroke="#fff"
            strokeWidth={1.5}
          />
        ) : null}
        <circle cx={x(index)} cy={y(point.previous)} r={4} fill="#6b7686" />
      </svg>
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
                <span className={cn(r.open && "font-medium text-[#ff8a1f]")}>
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
  const max = Math.max(1, ...mix.map((m) => m.newCustomers + m.returning));
  const fresh = mix.reduce((s, m) => s + m.newCustomers, 0);
  const back = mix.reduce((s, m) => s + m.returning, 0);
  return (
    <SectionCard
      title="New and returning customers"
      hint={`${fresh} first-time and ${back} repeat customer visits, by ${ranges.bucket}. ${segmentActive ? "Shows every customer; the filter above does not apply here. " : ""}Hover a bar for its numbers.`}
    >
      <div
        className="flex h-40 items-end gap-1"
        role="img"
        aria-label={`${fresh} first-time and ${back} repeat customer visits`}
      >
        {mix.map((m) => (
          <div
            key={m.key}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
            title={`${m.label}: ${m.newCustomers} new, ${m.returning} returning`}
          >
            <div
              className="bg-[#6b7686]"
              style={{ height: `${(m.returning / max) * 100}%` }}
            />
            <div
              className="bg-primary"
              style={{ height: `${(m.newCustomers / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <p className="flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-primary" /> New
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-[#6b7686]" /> Returning
        </span>
      </p>
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
