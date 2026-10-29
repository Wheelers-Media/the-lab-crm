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
  tone: "good" | "primary" | "danger" | "warn";
  onTrigger: () => void;
};

const TONES: Record<SwipeAction["tone"], string> = {
  good: "bg-emerald-600 text-white",
  primary: "bg-primary text-primary-foreground",
  danger: "bg-red-600 text-white",
  warn: "bg-amber-500 text-black",
};

/**
 * A list row you can swipe, like Mail and Reminders: swipe left for the
 * trailing action (remove, cancel, call), swipe right for the leading one
 * (done, next step). The action shows behind the row and runs on release past
 * the threshold, with a light haptic tick. Every swipe action is in the row's
 * hold menu too, so nothing depends on knowing the gesture.
 */
export const SwipeRow = ({
  action,
  leading,
  children,
  className = "rounded-lg",
}: {
  /** Swipe left. */
  action?: SwipeAction;
  /** Swipe right. */
  leading?: SwipeAction;
  children: ReactNode;
  className?: string;
}) => {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const horizontal = useRef(false);
  const swiped = useRef(false);
  const armed = useRef(false);

  if (!action && !leading) return <>{children}</>;
  const shown = offset < 0 ? action : offset > 0 ? leading : undefined;
  const past = Math.abs(offset) >= TRIGGER_PX;
  const Icon = shown?.icon;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {shown && Icon ? (
        <div
          aria-hidden
          className={`absolute inset-0 flex items-center gap-2 px-5 text-sm font-semibold ${
            offset < 0 ? "justify-end" : "justify-start"
          } ${TONES[shown.tone]}`}
        >
          <Icon
            className={`size-5 transition-transform ${past ? "scale-110" : "scale-90"}`}
          />
          {shown.label}
        </div>
      ) : null}
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
          // Only the directions that have an action move the row
          const next = Math.max(
            action ? -Infinity : 0,
            Math.min(leading ? Infinity : 0, dx),
          );
          // Tick once when crossing the threshold
          if (Math.abs(next) >= TRIGGER_PX && !armed.current) {
            armed.current = true;
            navigator.vibrate?.(10);
          } else if (Math.abs(next) < TRIGGER_PX) armed.current = false;
          setOffset(next);
        }}
        onTouchEnd={() => {
          setDragging(false);
          if (horizontal.current && past) shown?.onTrigger();
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
