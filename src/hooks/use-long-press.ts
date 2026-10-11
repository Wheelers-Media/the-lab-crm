import { useCallback, useRef } from "react";

const HOLD_MS = 450;
// A finger that drifts further than this is scrolling, not holding
const MOVE_TOLERANCE_PX = 10;

/**
 * Tap and hold, like iOS: after a short hold `onLongPress` runs with a light
 * haptic tick, and the tap that ends the hold is swallowed so the row does
 * not also open. Spread the returned handlers on the row.
 */
export const useLongPress = (onLongPress: () => void) => {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    window.clearTimeout(timer.current);
    start.current = null;
  }, []);

  const fire = useCallback(() => {
    fired.current = true;
    navigator.vibrate?.(12);
    onLongPress();
  }, [onLongPress]);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(fire, HOLD_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return;
      const dx = Math.abs(e.clientX - start.current.x);
      const dy = Math.abs(e.clientY - start.current.y);
      if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    // Android sends a context menu on hold; desktop right-click opens the same sheet
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      clear();
      if (!fired.current) fire();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
  };
};
