import { useEffect } from "react";
import { useNavigate } from "react-router";

// Start within this distance of the left edge, like iOS
const EDGE_PX = 24;
// Release past this share of the width to go back
const COMMIT_SHARE = 0.33;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as { standalone?: boolean }).standalone === true;

const dialogOpen = () =>
  Boolean(document.querySelector('[role="dialog"][data-state="open"]'));

/**
 * Swipe from the left edge to go back, as on any iPhone screen. Installed
 * on the home screen the CRM has no browser swipe, so it brings its own;
 * in Safari the browser already does this and this stays off.
 */
export const SwipeBack = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isStandalone()) return;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let tracking = false;
    let horizontal = false;
    const page = () => document.getElementById("main-content");
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      const idx = (window.history.state as { idx?: number } | null)?.idx;
      if (t.clientX > EDGE_PX || !idx || dialogOpen()) return;
      tracking = true;
      horizontal = false;
      startX = t.clientX;
      startY = t.clientY;
      dx = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      dx = Math.max(0, t.clientX - startX);
      const dy = Math.abs(t.clientY - startY);
      if (!horizontal) {
        if (dy > dx) {
          tracking = false;
          return;
        }
        if (dx > 8) horizontal = true;
      }
      const el = page();
      if (horizontal && el && !reduced) {
        el.style.transition = "none";
        el.style.transform = `translateX(${dx}px)`;
      }
    };
    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      const el = page();
      const commit = horizontal && dx > window.innerWidth * COMMIT_SHARE;
      if (el) {
        el.style.transition = "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)";
        el.style.transform =
          commit && !reduced ? `translateX(${window.innerWidth}px)` : "";
      }
      if (!commit) return;
      window.setTimeout(
        () => {
          navigate(-1);
          if (el) {
            el.style.transition = "none";
            el.style.transform = "";
          }
        },
        reduced ? 0 : 180,
      );
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [navigate]);

  return null;
};
