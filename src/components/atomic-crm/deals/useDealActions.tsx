import {
  Archive,
  ArrowRight,
  CircleSlash,
  FileText,
  KanbanSquare,
  UserRound,
} from "lucide-react";
import { useGetManyAggregate, useNotify, useUpdate } from "ra-core";
import { useNavigate } from "react-router";

import { reachActions } from "../contacts/reach";
import type { SheetAction } from "../misc/ActionSheet";
import type { SwipeAction } from "../misc/SwipeRow";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Deal } from "../types";

const CLOSED = new Set(["won", "lost"]);

/**
 * Everything a job row offers besides opening it: the quote, the customer,
 * the next stage, Not now and Archive. Moves show an Undo for a few seconds
 * before they are saved, so a stray swipe costs nothing.
 */
export const useDealActions = (
  deal: Deal,
): {
  actions: SheetAction[];
  swipeLeft?: SwipeAction;
  swipeRight?: SwipeAction;
  stageLabel?: string;
} => {
  const { dealStages } = useConfigurationContext();
  const navigate = useNavigate();
  const notify = useNotify();
  const [update] = useUpdate<Deal>();
  // Batched with every other row on screen into one request
  const customerId = deal.contact_ids?.[0];
  const { data: contacts } = useGetManyAggregate<Contact>(
    "contacts",
    { ids: customerId != null ? [customerId] : [] },
    { enabled: customerId != null },
  );
  const contact = contacts?.[0];

  const at = dealStages.findIndex((s) => s.value === deal.stage);
  const next = CLOSED.has(deal.stage) ? undefined : dealStages[at + 1];

  const save = (data: Partial<Deal>, message: string) =>
    update(
      "deals",
      { id: deal.id, data, previousData: deal },
      {
        mutationMode: "undoable",
        onSuccess: () => notify(message, { type: "info", undoable: true }),
        onError: () =>
          notify("Could not save that. Try again.", { type: "error" }),
      },
    );
  const move = (stage: string, label: string) =>
    save(
      { stage, stage_changed_at: new Date().toISOString() },
      `Moved to ${label}`,
    );
  const notNow = () => move("lost", "Not now");
  const archive = () =>
    save({ archived_at: new Date().toISOString() }, "Job archived");

  const actions: SheetAction[] = [
    {
      label: "Open job",
      icon: KanbanSquare,
      onSelect: () => navigate(`/deals/${deal.id}/show`),
    },
    {
      label: deal.packages?.length ? "Open quote" : "Build quote",
      icon: FileText,
      onSelect: () => navigate(`/quotes/${deal.id}`),
    },
    ...reachActions(contact),
    {
      label: "Open customer",
      icon: UserRound,
      hidden: customerId == null,
      onSelect: () => navigate(`/contacts/${customerId}/show`),
    },
    {
      label: next ? `Move to ${next.label}` : "",
      icon: ArrowRight,
      hidden: !next,
      onSelect: () => next && move(next.value, next.label),
    },
    {
      label: "Not now",
      icon: CircleSlash,
      destructive: true,
      hidden: CLOSED.has(deal.stage),
      onSelect: notNow,
    },
    {
      label: "Archive job",
      icon: Archive,
      destructive: true,
      onSelect: archive,
    },
  ];

  return {
    actions,
    stageLabel: dealStages[at]?.label,
    swipeRight: next
      ? {
          label: next.label,
          icon: ArrowRight,
          tone: "primary",
          onTrigger: () => move(next.value, next.label),
        }
      : undefined,
    swipeLeft: CLOSED.has(deal.stage)
      ? {
          label: "Archive",
          icon: Archive,
          tone: "danger",
          onTrigger: archive,
        }
      : {
          label: "Not now",
          icon: CircleSlash,
          tone: "warn",
          onTrigger: notNow,
        },
  };
};
