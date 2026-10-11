import type { LucideIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

// Drag past this to trigger the action on release
const TRIGGER_PX = 88;
// A drag this far is a swipe, not a tap
const SLOP_PX = 8;

export type SwipeAction = {
  label: string;
  icon: LucideIcon;
  /** Background behind the row while swiping. */
  tone: "good" | "primary";
  onTrigger: () => void;
};

const TONES = {
  good: "bg-emerald-600 text-white",
  primary: "bg-primary text-primary-foreground",
};

/**
 * A list row you can swipe left to act on, like Mail and Reminders: the
 * action shows behind the row and runs on release past the threshold, with a
 * light haptic tick. The same action is always in the row's hold menu too.
 */
export const SwipeRow = ({
  action,
  children,
}: {
  action?: SwipeAction;
  children: ReactNode;
}) => {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const horizontal = useRef(false);
  const swiped = useRef(false);
  const armed = useRef(false);

  if (!action) return <>{children}</>;
  const Icon = action.icon;
  const past = -offset >= TRIGGER_PX;

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div
        aria-hidden
        className={`absolute inset-0 flex items-center justify-end gap-2 px-5 text-sm font-semibold transition-opacity ${TONES[action.tone]} ${offset < 0 ? "opacity-100" : "opacity-0"}`}
      >
        <Icon
          className={`size-5 transition-transform ${past ? "scale-110" : "scale-90"}`}
        />
        {action.label}
      </div>
      <div
        className="relative bg-background touch-pan-y"
        style={{
          transform: offset ? `translateX(${offset}px)` : undefined,
          transition: dragging
            ? "none"
            : "transform 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          start.current = { x: t.clientX, y: t.clientY };
          horizontal.current = false;
          swiped.current = false;
          armed.current = false;
        }}
        onTouchMove={(e) => {
          if (!start.current) return;
          const t = e.touches[0];
          const dx = t.clientX - start.current.x;
          const dy = t.clientY - start.current.y;
          if (!horizontal.current) {
            if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < SLOP_PX) return;
            horizontal.current = true;
            swiped.current = true;
            setDragging(true);
          }
          const next = Math.min(0, dx);
          // Tick once when crossing the threshold
          if (-next >= TRIGGER_PX && !armed.current) {
            armed.current = true;
            navigator.vibrate?.(10);
          } else if (-next < TRIGGER_PX) armed.current = false;
          setOffset(next);
        }}
        onTouchEnd={() => {
          setDragging(false);
          if (horizontal.current && past) action.onTrigger();
          setOffset(0);
          start.current = null;
        }}
        onTouchCancel={() => {
          setDragging(false);
          setOffset(0);
          start.current = null;
        }}
        onClickCapture={(e) => {
          // A swipe is not a tap on the row
          if (swiped.current) {
            e.preventDefault();
            e.stopPropagation();
            swiped.current = false;
          }
        }}
      >
        {children}
      </div>
    </div>
  );
};
