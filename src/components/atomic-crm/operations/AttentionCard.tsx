import {
  BellOff,
  BellRing,
  CircleDollarSign,
  ClipboardList,
  FileClock,
  Inbox,
  PackageCheck,
  ShoppingCart,
  Wrench,
} from "lucide-react";
import { useDataProvider, useNotify } from "ra-core";
import { type ComponentType, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { CrmDataProvider } from "../providers/types";
import {
  useConfigurationContext,
  useConfigurationUpdater,
} from "../root/ConfigurationContext";
import type { AttentionItem, AttentionKind } from "./attentionModel";
import {
  type AttentionSnoozes,
  snoozeItem,
  splitSnoozed,
} from "./attentionSnooze";
import { money } from "./format";
import { SectionTitle } from "./OperationsWidgets";
import { formatShopDay, formatShopTime, shopDayKey } from "./shopTime";

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
    to: "/tasks",
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

/** The detail line, plus how many older ones were left out of the count. */
const detailLine = (item: AttentionItem, now: Date): string =>
  [attentionDetail(item, now), item.older ? `${item.older} older` : ""]
    .filter(Boolean)
    .join(" · ");

/**
 * One row: the whole row opens the page that deals with it, and the bell
 * beside it hides the row for a week.
 */
const AttentionRow = ({
  item,
  now,
  onSnooze,
  isSaving,
}: {
  item: AttentionItem;
  now: Date;
  onSnooze: (item: AttentionItem) => void;
  isSaving: boolean;
}) => {
  const config = ATTENTION[item.kind];
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-1">
      <Link
        to={config.to}
        className="-ml-2 flex min-h-12 min-w-0 flex-1 items-start gap-3 rounded-md px-2 py-2 hover:bg-muted"
      >
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{config.title(item)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {detailLine(item, now)}
          </p>
        </div>
        <span className={cn("lab-chip", config.chip)}>{config.action}</span>
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="-mr-2 size-11 shrink-0 text-muted-foreground"
        aria-label={`Hide "${config.title(item)}" for a week`}
        title="Hide for a week"
        disabled={isSaving}
        onClick={() => onSnooze(item)}
      >
        <BellOff className="size-4" aria-hidden />
      </Button>
    </div>
  );
};

/**
 * What costs money if it waits. Rows can be hidden for a week; hidden rows
 * come back on their own, sooner if something new joins them, and the
 * footer brings them all back at once.
 */
export const AttentionCard = ({
  items,
  now,
}: {
  items: AttentionItem[];
  now: Date;
}) => {
  const config = useConfigurationContext();
  const setConfig = useConfigurationUpdater();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const [isSaving, setSaving] = useState(false);
  const { shown, hidden } = splitSnoozed(items, config.attentionSnoozed, now);

  const save = async (attentionSnoozed: AttentionSnoozes, message: string) => {
    setSaving(true);
    try {
      const saved = await dataProvider.updateConfiguration({
        ...config,
        attentionSnoozed,
      });
      setConfig({ ...config, ...saved, attentionSnoozed });
      notify(message);
    } catch {
      notify("Could not save that. Try again.", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="gap-0 p-4">
      <SectionTitle icon={BellRing} hint="What costs money if it waits.">
        Needs attention
      </SectionTitle>
      {shown.length ? (
        <div className="divide-y divide-border">
          {shown.map((item) => (
            <AttentionRow
              key={item.kind}
              item={item}
              now={now}
              isSaving={isSaving}
              onSnooze={(row) =>
                save(
                  snoozeItem(config.attentionSnoozed, row, now),
                  "Hidden for a week",
                )
              }
            />
          ))}
        </div>
      ) : (
        <p className="py-2 text-sm text-muted-foreground">
          All caught up. New requests, waiting quotes, unpaid deposits and big
          abandoned carts show up here.
        </p>
      )}
      {hidden.length ? (
        <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-2">
          <p className="text-xs text-muted-foreground">
            {hidden.length === 1
              ? "1 row hidden"
              : `${hidden.length} rows hidden`}{" "}
            for now
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isSaving}
            onClick={() => save({}, "Showing every row again")}
          >
            Show
          </Button>
        </div>
      ) : null}
    </Card>
  );
};
