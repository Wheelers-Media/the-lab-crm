import { Star } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

import type { Order } from "../types";
import { canAskReview } from "./orderReview";
import { ReviewAskDialog, useOrderAsked } from "./ReviewAskDialog";

/** "Ask for review" on an order row, or "Review asked" once it has gone out. */
export const ReviewAskButton = ({ order }: { order: Order }) => {
  const [open, setOpen] = useState(false);
  const asked = useOrderAsked(order);
  if (!canAskReview(order)) return null;
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        size="sm"
        variant={asked ? "ghost" : "outline"}
        onClick={() => setOpen(true)}
      >
        <Star className="size-3.5" aria-hidden />
        {asked ? "Review asked" : "Ask for review"}
      </Button>
      <ReviewAskDialog
        order={open ? order : null}
        onClose={() => setOpen(false)}
      />
    </div>
  );
};
