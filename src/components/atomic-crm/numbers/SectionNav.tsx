import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface NumbersSection {
  id: string;
  label: string;
}

/**
 * The parts of Numbers as tabs: one part on screen at a time, like the
 * segmented sections of a native app, instead of one very long scroll.
 * The bar sticks under the header so switching is always one tap away.
 */
export const SectionNav = ({
  sections,
  current,
  onPick,
}: {
  sections: NumbersSection[];
  current: string;
  onPick: (id: string) => void;
}) => {
  const bar = useRef<HTMLDivElement>(null);
  // Keep the open tab in sight when it sits past the edge of a narrow screen
  useEffect(() => {
    const tab = bar.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    tab?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [current]);
  return (
    <nav
      aria-label="Parts of Numbers"
      className="sticky top-0 md:top-14 z-30 -mx-4 border-b border-border/60 bg-background/90 px-4 backdrop-blur-xl md:mx-0 md:px-0"
    >
      <div ref={bar} role="tablist" className="lab-scroll-x flex gap-5">
        {sections.map(({ id, label }) => {
          const active = current === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                onPick(id);
                window.scrollTo({ top: 0 });
              }}
              className={cn(
                // Text tabs with an underline, so they never read as a second
                // row of the period picker above
                "relative inline-flex h-11 shrink-0 items-center text-[15px] font-medium whitespace-nowrap transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors",
                active
                  ? "text-foreground after:bg-foreground"
                  : "text-muted-foreground after:bg-transparent hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
