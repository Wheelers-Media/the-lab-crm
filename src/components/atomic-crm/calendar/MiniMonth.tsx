import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import { formatShopDay } from "../operations/shopTime";
import { monthDays, monthStart, shiftMonth } from "./monthRange";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * The small month in Google Calendar's left rail: jump to any day, step a
 * month at a time, today and the chosen day marked.
 */
export const MiniMonth = ({
  date,
  todayKey,
  onSelect,
}: {
  /** The day shown on the main calendar. */
  date: string;
  todayKey: string;
  onSelect: (key: string) => void;
}) => {
  const monthKey = date.slice(0, 7);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">
          {formatShopDay(monthStart(date), { month: "long", year: "numeric" })}
        </span>
        <span className="flex">
          <button
            type="button"
            aria-label="Previous month"
            className="grid size-7 place-items-center rounded-full hover:bg-muted"
            onClick={() => onSelect(shiftMonth(date, -1, todayKey))}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            className="grid size-7 place-items-center rounded-full hover:bg-muted"
            onClick={() => onSelect(shiftMonth(date, 1, todayKey))}
          >
            <ChevronRight className="size-4" />
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 text-center" aria-hidden="true">
        {LETTERS.map((letter, i) => (
          <span key={i} className="py-1 text-[11px] text-muted-foreground">
            {letter}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {monthDays(date).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            aria-label={formatShopDay(key, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            aria-pressed={key === date}
            className="grid h-8 place-items-center"
          >
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full text-xs lab-num hover:bg-muted",
                key.slice(0, 7) !== monthKey && "text-muted-foreground/50",
                key === date && "bg-[var(--lab-blue)]/25 font-semibold",
                key === todayKey &&
                  "bg-primary font-semibold text-primary-foreground hover:bg-primary",
              )}
            >
              {formatShopDay(key, { day: "numeric" })}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
