// Hiding a "Needs attention" row for a week. A snooze is shared through the
// shop's settings, so hiding a row on the phone hides it on the desk too. It
// ends early when the row grows: a new abandoned cart is new news.
import type { AttentionItem, AttentionKind } from "./attentionModel";

const DAY_MS = 86_400_000;
export const SNOOZE_DAYS = 7;

export interface AttentionSnooze {
  /** When the row comes back on its own. */
  until: string;
  /** How many items the row had when it was hidden. */
  count: number;
}

export type AttentionSnoozes = Partial<Record<AttentionKind, AttentionSnooze>>;

/** Hidden while the snooze lasts and nothing new has joined the row. */
export const isSnoozed = (
  item: AttentionItem,
  snoozes: AttentionSnoozes | undefined,
  now: Date,
): boolean => {
  const snooze = snoozes?.[item.kind];
  return (
    snooze != null &&
    new Date(snooze.until).getTime() > now.getTime() &&
    item.count <= snooze.count
  );
};

/** The snoozes with this row hidden for a week from now. */
export const snoozeItem = (
  snoozes: AttentionSnoozes | undefined,
  item: AttentionItem,
  now: Date,
): AttentionSnoozes => ({
  ...snoozes,
  [item.kind]: {
    until: new Date(now.getTime() + SNOOZE_DAYS * DAY_MS).toISOString(),
    count: item.count,
  },
});

/** The rows to show, and the ones hidden for now. */
export const splitSnoozed = (
  items: AttentionItem[],
  snoozes: AttentionSnoozes | undefined,
  now: Date,
): { shown: AttentionItem[]; hidden: AttentionItem[] } => ({
  shown: items.filter((item) => !isSnoozed(item, snoozes, now)),
  hidden: items.filter((item) => isSnoozed(item, snoozes, now)),
});
