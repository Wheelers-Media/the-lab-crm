import { CalendarCheck, Clock } from "lucide-react";
import { useGetList } from "ra-core";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

import { findDealLabel } from "./dealUtils";
import {
  formatShopDay,
  formatShopTime,
  shopDayKey,
} from "../operations/shopTime";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Appointment, Deal } from "../types";
import {
  ageLabel,
  ageShort,
  type ColumnAge,
  jobAge,
  shortDay,
  TONE_CHIP,
} from "./jobAge";

/**
 * How long the job has sat in its stage, coloured green, amber or red against
 * the stage's limits, with the day it got there. A booked job shows its
 * appointment instead, since that is the date that matters.
 */
export const JobAgeTag = ({ deal }: { deal: Deal }) => {
  const now = useMemo(() => new Date(), []);
  const { dealStages } = useConfigurationContext();
  const age = jobAge(deal, now);
  if (!age) return null;
  if (deal.stage === "booked") return <BookedFor deal={deal} days={age.days} />;

  const stageLabel = findDealLabel(dealStages, deal.stage) ?? deal.stage;
  const toneWord =
    age.tone === "stale"
      ? ", overdue"
      : age.tone === "aging"
        ? ", getting old"
        : "";
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span
        className={cn("lab-chip lab-num", TONE_CHIP[age.tone ?? "none"])}
        title={`${ageLabel(age.days)} in ${stageLabel}${toneWord}`}
        aria-label={`${ageLabel(age.days)} in ${stageLabel}${toneWord}`}
      >
        <Clock className="size-3" aria-hidden />
        {ageShort(age.days)}
      </span>
      <span className="lab-num whitespace-nowrap">
        since {shortDay(age.since)}
      </span>
    </p>
  );
};

/** The job's next appointment; falls back to its age when none is on the calendar. */
const BookedFor = ({ deal, days }: { deal: Deal; days: number }) => {
  const { data = [] } = useGetList<Appointment>("appointments", {
    filter: { deal_id: deal.id },
    sort: { field: "start_at", order: "ASC" },
    pagination: { page: 1, perPage: 10 },
  });
  const now = Date.now();
  const next = data.find(
    (a) =>
      (a.status === "booked" || a.status === "rescheduled") &&
      new Date(a.end_at ?? a.start_at).getTime() >= now,
  );
  if (!next) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span
          className="lab-chip lab-chip-muted lab-num"
          title={`${ageLabel(days)} in Booked, no appointment on the calendar`}
        >
          <Clock className="size-3" aria-hidden />
          {ageShort(days)}
        </span>
        <span className="whitespace-nowrap">Not on calendar</span>
      </p>
    );
  }
  const day = shopDayKey(next.start_at);
  return (
    <p className="text-xs">
      <span className="lab-chip lab-chip-eric lab-num">
        <CalendarCheck className="size-3" aria-hidden />
        {formatShopDay(day, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
        , {formatShopTime(next.start_at)}
      </span>
    </p>
  );
};

/** "Oldest 9 days · 2 overdue · 1 getting old" under a column heading. */
export const ColumnAgeLine = ({
  age,
  className,
}: {
  age: ColumnAge;
  className?: string;
}) => {
  if (age.oldestDays == null) return null;
  return (
    <p className={cn("text-xs text-muted-foreground lab-num", className)}>
      <span className="whitespace-nowrap">
        Oldest {ageLabel(age.oldestDays).toLowerCase()}
      </span>
      {age.stale ? (
        <>
          {" · "}
          <span className="whitespace-nowrap text-[color-mix(in_oklab,#e5484d_75%,var(--foreground))]">
            {age.stale} overdue
          </span>
        </>
      ) : null}
      {age.aging ? (
        <>
          {" · "}
          <span className="whitespace-nowrap text-[color-mix(in_oklab,var(--lab-amber)_75%,var(--foreground))]">
            {age.aging} getting old
          </span>
        </>
      ) : null}
    </p>
  );
};
