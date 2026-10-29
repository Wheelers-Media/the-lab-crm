import { Draggable } from "@hello-pangea/dnd";
import { useState } from "react";

import { ActionSheet } from "../misc/ActionSheet";
import type { Deal } from "../types";
import { DealCardContent } from "./DealCardContent";
import { useDealActions } from "./useDealActions";

/**
 * A job on the desk board. Drag it between stages; right-click it for the
 * same menu a phone gets on tap and hold. Only right-click, so dragging keeps
 * the press to itself.
 */
export const DealCard = ({ deal, index }: { deal: Deal; index: number }) => {
  const [open, setOpen] = useState(false);
  const { actions, stageLabel } = useDealActions(deal);

  return (
    <>
      <Draggable draggableId={String(deal.id)} index={index}>
        {(provided, snapshot) => (
          <DealCardContent
            provided={provided}
            snapshot={snapshot}
            deal={deal}
            onContextMenu={(event) => {
              event.preventDefault();
              setOpen(true);
            }}
          />
        )}
      </Draggable>
      <ActionSheet
        open={open}
        onOpenChange={setOpen}
        title={deal.name}
        subtitle={stageLabel}
        actions={actions.filter((a) => !a.hidden)}
      />
    </>
  );
};
