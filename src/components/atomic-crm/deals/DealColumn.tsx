import { Droppable } from "@hello-pangea/dnd";
import { useState } from "react";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { findDealLabel } from "./dealUtils";
import { DealCard } from "./DealCard";
import { columnView, RECENT_CLOSED_DAYS, stageTotal } from "./pipelineView";

export const DealColumn = ({
  stage,
  deals,
}: {
  stage: string;
  deals: Deal[];
}) => {
  const { dealStages, currency } = useConfigurationContext();
  const [showOlder, setShowOlder] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const view = columnView(deals, stage, { showOlder, showAll });
  const totalAmount = stageTotal(deals);
  return (
    <div className="flex-1 min-w-0 pb-8">
      <div className="flex flex-col items-center">
        <h3 className="text-base font-display uppercase tracking-wide">
          {findDealLabel(dealStages, stage)}{" "}
          <span className="text-muted-foreground lab-num">{deals.length}</span>
        </h3>
        <p className="text-sm text-muted-foreground lab-num">
          {totalAmount.toLocaleString("en-CA", {
            style: "currency",
            currency,
            currencyDisplay: "narrowSymbol",
            maximumFractionDigits: 0,
          })}
        </p>
      </div>
      <Droppable droppableId={stage}>
        {(droppableProvided, snapshot) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className={`flex flex-col rounded-md mt-2 gap-2 min-h-12 ${
              snapshot.isDraggingOver ? "bg-muted" : ""
            }`}
          >
            {/* The visible cards are always the start of the column (closed
                stages are sorted newest first), so drag indexes stay true. */}
            {view.visible.map((deal, index) => (
              <DealCard key={deal.id} deal={deal} index={index} />
            ))}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
      {view.moreCount > 0 ? (
        <ColumnToggle onClick={() => setShowAll(true)}>
          Show {view.moreCount} more
        </ColumnToggle>
      ) : null}
      {view.olderCount > 0 ? (
        <ColumnToggle onClick={() => setShowOlder(true)}>
          {view.olderCount} older than {RECENT_CLOSED_DAYS} days
        </ColumnToggle>
      ) : null}
      {showOlder || showAll ? (
        <ColumnToggle
          onClick={() => {
            setShowOlder(false);
            setShowAll(false);
          }}
        >
          Show less
        </ColumnToggle>
      ) : null}
    </div>
  );
};

const ColumnToggle = ({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="mt-2 w-full rounded-md border border-dashed border-border py-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/40"
  >
    {children}
  </button>
);
