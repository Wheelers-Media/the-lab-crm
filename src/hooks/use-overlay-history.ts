import { useEffect, useRef } from "react";

// A pop-up (sheet, dialog, menu) takes one step in the browser history while
// it is open, so Back closes it first and a second Back leaves the page, as
// on an iPhone. The step is added with the router's own state copied onto it,
// so the router still sees the page it was on.
const MARK = "__labOverlay";

interface Entry {
  close: () => void;
}
const stack: Entry[] = [];
let installed = false;

const marked = () =>
  Boolean((window.history.state as Record<string, unknown> | null)?.[MARK]);

// Going back past a pop-up whose step was left behind (the page changed under
// it) lands on that spare step: skip over it
const install = () => {
  if (installed) return;
  installed = true;
  window.addEventListener("popstate", () => {
    if (!stack.length && marked()) window.history.back();
  });
};

export const useOverlayHistory = (
  open: boolean,
  close: () => void,
  enabled = true,
) => {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open || !enabled) return;
    install();
    const entry: Entry = { close: () => closeRef.current() };
    let pushed = false;
    let popped = false;
    // Deferred a tick so a development double-run never leaves a step behind
    const timer = window.setTimeout(() => {
      window.history.pushState(
        { ...(window.history.state ?? {}), [MARK]: true },
        "",
      );
      stack.push(entry);
      pushed = true;
    }, 0);
    const onPop = () => {
      // Only the top-most pop-up answers Back
      if (!pushed || popped || stack[stack.length - 1] !== entry) return;
      popped = true;
      stack.pop();
      entry.close();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", onPop);
      const at = stack.indexOf(entry);
      if (at >= 0) stack.splice(at, 1);
      // Closed some other way: drop our step, unless the page already moved on
      if (pushed && !popped && marked()) window.history.back();
    };
  }, [open, enabled]);
};
