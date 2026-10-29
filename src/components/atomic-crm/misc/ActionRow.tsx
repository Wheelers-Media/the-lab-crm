import { useState, type ReactNode } from "react";
import { useLongPress } from "@/hooks/use-long-press";

import { ActionSheet, type SheetAction } from "./ActionSheet";
import { type SwipeAction, SwipeRow } from "./SwipeRow";

/**
 * Everything a list row offers besides its tap: hold it (or right-click it on
 * a desk) for the full menu, swipe left or right for the two most common
 * actions. The sheet lives outside the row so a tap inside it never reaches
 * the row underneath.
 */
export const ActionRow = ({
  title,
  subtitle,
  actions,
  swipeLeft,
  swipeRight,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  swipeLeft?: SwipeAction;
  swipeRight?: SwipeAction;
  children: ReactNode;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const longPress = useLongPress(() => setOpen(true));
  return (
    <>
      <SwipeRow action={swipeLeft} leading={swipeRight} className={className}>
        <div {...longPress} data-long-press="">
          {children}
        </div>
      </SwipeRow>
      <ActionSheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        subtitle={subtitle}
        actions={actions.filter((a) => !a.hidden)}
      />
    </>
  );
};
