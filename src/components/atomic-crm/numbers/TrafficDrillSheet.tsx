import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

import { percentText, type TrafficGroup } from "./trafficModel";

/** The sources behind one bar of the traffic chart, shown in a sheet. */
export interface TrafficDrill {
  title: string;
  sources: TrafficGroup[];
}

const count = (n: number) => n.toLocaleString("en-CA");

export const TrafficDrillSheet = ({
  drill,
  onPick,
  onClose,
}: {
  drill: TrafficDrill | null;
  /** Filters the section to the source tapped. */
  onPick: (sourceKey: string) => void;
  onClose: () => void;
}) => {
  const isMobile = useIsMobile();
  const sources = drill?.sources ?? [];
  const sessions = sources.reduce((s, r) => s + r.sessions, 0);
  const completed = sources.reduce((s, r) => s + r.completed, 0);

  return (
    <Sheet open={drill != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "max-h-[85dvh] overflow-y-auto"
            : "w-full overflow-y-auto sm:max-w-md"
        }
      >
        <SheetHeader>
          <SheetTitle>{drill?.title}</SheetTitle>
          <SheetDescription>
            {count(sessions)} {sessions === 1 ? "session" : "sessions"},{" "}
            {count(completed)} completed checkout
            {completed === 1 ? "" : "s"}. Tap a source to filter the traffic
            section to it.
          </SheetDescription>
        </SheetHeader>
        {sources.length ? (
          <ul className="divide-y divide-border px-4 pb-6">
            {sources.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(s.key);
                    onClose();
                  }}
                  className="flex w-full items-start justify-between gap-3 py-3 text-left hover:bg-muted/60"
                >
                  <span className="min-w-0">
                    <span className="block font-medium truncate">
                      {s.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {s.kind}
                    </span>
                  </span>
                  <span className="shrink-0 text-right lab-num">
                    <span className="block font-medium">
                      {count(s.sessions)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {s.completed} completed, {percentText(s.conversion)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 pb-6 text-sm text-muted-foreground">
            No visits here.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
};
