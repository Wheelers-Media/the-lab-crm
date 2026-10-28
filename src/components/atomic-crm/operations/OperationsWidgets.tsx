import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  FileClock,
  Inbox,
  PackageCheck,
  ShoppingCart,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { Appointment, Contact } from "../types";
import { contactName, money } from "./format";
import {
  type AttentionItem,
  type AttentionKind,
  bayLoad,
  type DayLoad,
} from "./metrics";
import { formatShopDay, formatShopTime, shopDayKey } from "./shopTime";

export const SectionTitle = ({
  icon: Icon,
  children,
  hint,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
  /** Says what the numbers under the title cover, so the title is not a riddle. */
  hint?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex items-center gap-2 mb-2">
    <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
    <div className="flex-1 min-w-0">
      <h2 className="text-lg font-semibold text-foreground">{children}</h2>
      {hint ? <p className="text-xs text-muted-foreground/80">{hint}</p> : null}
    </div>
    {action ? (
      // Links like "Calendar" get a full 44pt tap target
      <span className="-my-2 inline-flex [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center">
        {action}
      </span>
    ) : null}
  </div>
);

export interface KpiTileProps {
  label: string;
  value: string;
  detail?: string;
  trend?: number | null;
  /** Opens the list behind the number */
  to?: string;
  /** Makes the tile a toggle (the Numbers screen picks its chart metric this way) */
  onSelect?: () => void;
  selected?: boolean;
}

export const KpiTile = ({
  label,
  value,
  detail,
  trend,
  to,
  onSelect,
  selected,
}: KpiTileProps) => {
  const tile = (
    <Card
      className={cn(
        "p-4 gap-1 h-full",
        (to || onSelect) && "transition-colors group-hover:bg-muted",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold lab-num">{value}</p>
      <p className="text-xs text-muted-foreground lab-num">
        {trend != null ? (
          <span
            className={cn(
              "mr-1",
              trend === 0
                ? "text-muted-foreground"
                : trend > 0
                  ? "text-[var(--lab-pos)]"
                  : "text-[var(--lab-neg)]",
            )}
          >
            {/* The arrow carries the direction for anyone who cannot see the hue */}
            {trend > 0 ? (
              <ArrowUp className="inline size-3" aria-hidden="true" />
            ) : trend < 0 ? (
              <ArrowDown className="inline size-3" aria-hidden="true" />
            ) : null}
            {Math.abs(trend)}%
          </span>
        ) : null}
        {detail}
      </p>
    </Card>
  );
  if (onSelect)
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="group block w-full rounded-lg text-left"
      >
        {tile}
      </button>
    );
  return to ? (
    <Link to={to} className="group block rounded-lg">
      {tile}
    </Link>
  ) : (
    tile
  );
};

export const ResourceChip = ({
  resource,
}: {
  resource: Appointment["resource"];
}) =>
  resource === "detailing-bay" ? (
    <span className="lab-chip lab-chip-bay">Bay</span>
  ) : (
    <span className="lab-chip lab-chip-eric">Eric</span>
  );

export const DepositChip = ({ appointment }: { appointment: Appointment }) =>
  appointment.deposit_paid ? (
    <span className="lab-chip lab-chip-muted">Deposit paid</span>
  ) : (
    <span className="lab-chip lab-chip-danger">No deposit</span>
  );

export const AppointmentRow = ({
  appointment,
  contact,
}: {
  appointment: Appointment;
  contact?: Contact;
}) => {
  const body = (
    <div className="flex items-start gap-3 py-2">
      <span className="text-sm text-muted-foreground w-16 shrink-0 lab-num">
        {formatShopTime(appointment.start_at)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{appointment.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {[contactName(contact), appointment.vehicle]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <ResourceChip resource={appointment.resource} />
        {appointment.status === "completed" ? (
          <span className="lab-chip lab-chip-muted">Done</span>
        ) : (
          <DepositChip appointment={appointment} />
        )}
      </div>
    </div>
  );
  return contact ? (
    <Link
      to={`/contacts/${contact.id}/show`}
      className="block rounded-md px-2 -mx-2 hover:bg-muted"
    >
      {body}
    </Link>
  ) : (
    body
  );
};

const ATTENTION: Record<
  AttentionKind,
  {
    icon: ComponentType<{ className?: string }>;
    chip: string;
    action: string;
    to: string;
    title: (item: AttentionItem) => string;
  }
> = {
  "abandoned-cart": {
    icon: ShoppingCart,
    chip: "lab-chip-warn",
    action: "Call",
    to: "/shopify_checkouts",
    title: (i) =>
      i.count === 1
        ? `Abandoned cart, ${money(i.amount ?? 0)}`
        : `${i.count} abandoned carts, ${money(i.amount ?? 0)}`,
  },
  "no-deposit": {
    icon: CircleDollarSign,
    chip: "lab-chip-danger",
    action: "Remind",
    to: "/calendar",
    title: (i) =>
      i.count === 1 ? "Booked, no deposit" : `${i.count} bookings, no deposit`,
  },
  "pickups-waiting": {
    icon: PackageCheck,
    chip: "lab-chip-warn",
    action: "Text",
    to: "/shop-floor",
    title: (i) =>
      i.count === 1
        ? "1 vehicle ready 2+ days"
        : `${i.count} vehicles ready 2+ days`,
  },
  "parts-waiting": {
    icon: Wrench,
    chip: "lab-chip-muted",
    action: "Chase",
    to: "/shop-floor",
    title: (i) =>
      i.count === 1
        ? "1 vehicle waiting on parts 5+ days"
        : `${i.count} vehicles waiting on parts 5+ days`,
  },
  "new-requests": {
    icon: Inbox,
    chip: "lab-chip-muted",
    action: "Quote",
    to: "/deals",
    title: (i) => (i.count === 1 ? "1 new request" : `${i.count} new requests`),
  },
  "quotes-waiting": {
    icon: FileClock,
    chip: "lab-chip-muted",
    action: "Follow up",
    to: "/deals",
    title: (i) =>
      i.count === 1
        ? "1 quote waiting 3+ days"
        : `${i.count} quotes waiting 3+ days`,
  },
  "overdue-tasks": {
    icon: ClipboardList,
    chip: "lab-chip-muted",
    action: "Open",
    to: "#tasks",
    title: (i) =>
      i.count === 1 ? "1 overdue task" : `${i.count} overdue tasks`,
  },
};

const ago = (iso: string, now: Date): string => {
  const minutes = Math.max(
    0,
    Math.round((now.getTime() - new Date(iso).getTime()) / 60000),
  );
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
};

const attentionDetail = (item: AttentionItem, now: Date): string => {
  if (item.kind === "no-deposit" && item.oldest) {
    return `Next: ${formatShopDay(shopDayKey(item.oldest))} ${formatShopTime(item.oldest)}${item.detail ? ` · ${item.detail}` : ""}`;
  }
  if (item.kind === "quotes-waiting" && item.amount) {
    return `${money(item.amount)} in quotes · oldest ${item.oldest ? ago(item.oldest, now) : ""}`;
  }
  return item.oldest ? `Oldest ${ago(item.oldest, now)}` : "";
};

export const AttentionRow = ({
  item,
  now,
}: {
  item: AttentionItem;
  now: Date;
}) => {
  const config = ATTENTION[item.kind];
  const Icon = config.icon;
  const content = (
    <>
      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{config.title(item)}</p>
        <p className="text-xs text-muted-foreground truncate">
          {attentionDetail(item, now)}
        </p>
      </div>
      <span className={cn("lab-chip", config.chip)}>{config.action}</span>
    </>
  );
  const className =
    "flex items-start gap-3 py-2 px-2 -mx-2 rounded-md hover:bg-muted";
  return config.to.startsWith("#") ? (
    <a href={config.to} className={className}>
      {content}
    </a>
  ) : (
    <Link to={config.to} className={className}>
      {content}
    </Link>
  );
};

export const WeekStrip = ({
  loads,
  todayKey,
}: {
  loads: DayLoad[];
  todayKey: string;
}) => (
  <Card className="p-4">
    <SectionTitle
      icon={CalendarDays}
      hint="Drop-off slots per day, and Eric's jobs beside them."
      action={
        <Link
          to="/calendar"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          Open calendar <ArrowRight className="w-4 h-4" />
        </Link>
      }
    >
      Bay capacity this week
    </SectionTitle>
    <div
      className="grid gap-2"
      style={{
        gridTemplateColumns: `repeat(${loads.length}, minmax(0, 1fr))`,
      }}
    >
      {loads.map((day) => {
        const bay = bayLoad(day.bay);
        return (
          <Link
            key={day.key}
            to={`/calendar?date=${day.key}&view=day`}
            className={cn(
              "rounded-md p-2 flex flex-col gap-1 hover:bg-muted",
              day.key === todayKey && "ring-1 ring-primary",
            )}
          >
            <span
              className={cn(
                "text-xs",
                day.key === todayKey
                  ? "font-semibold"
                  : "text-muted-foreground",
              )}
            >
              {formatShopDay(day.key, { weekday: "short", day: "numeric" })}
            </span>
            <span
              className={cn(
                "lab-chip",
                bay.over
                  ? "lab-chip-danger"
                  : day.bay === 0
                    ? "lab-chip-muted"
                    : "lab-chip-bay",
              )}
            >
              {bay.label}
            </span>
            <span
              className={cn(
                "lab-chip",
                day.eric === 0 ? "lab-chip-muted" : "lab-chip-eric",
              )}
            >
              Eric {day.eric}
            </span>
          </Link>
        );
      })}
    </div>
  </Card>
);
