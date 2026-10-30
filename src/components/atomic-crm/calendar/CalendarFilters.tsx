import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import {
  type CalendarFilters,
  DEFAULT_FILTERS,
  filtersActive,
  parseFilters,
} from "./filterModel";

const KEY = "labCalendarFilters";

/** The switches, remembered on this device like Google remembers your calendars. */
export const useCalendarFilters = () => {
  const [filters, setFilters] = useState<CalendarFilters>(() => {
    try {
      return parseFilters(localStorage.getItem(KEY));
    } catch {
      return DEFAULT_FILTERS;
    }
  });
  const update = (next: CalendarFilters) => {
    setFilters(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: the switches still work for this visit */
    }
  };
  return [filters, update] as const;
};

const Row = ({
  label,
  checked,
  onChange,
  dot,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  dot?: string;
}) => (
  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 hover:bg-muted">
    {/* The row is the 44pt tap target; the global touch rule must not stretch the box itself */}
    <Checkbox
      checked={checked}
      onCheckedChange={(v) => onChange(v === true)}
      className="size-5 !min-h-0 !min-w-0"
    />
    {dot ? (
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", dot)}
      />
    ) : null}
    <span className="text-sm">{label}</span>
  </label>
);

const Group = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div>
    <p className="lab-eyebrow mb-1">{title}</p>
    {children}
  </div>
);

const FilterForm = ({
  filters,
  onChange,
}: {
  filters: CalendarFilters;
  onChange: (next: CalendarFilters) => void;
}) => {
  const set = (patch: Partial<CalendarFilters>) =>
    onChange({ ...filters, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Group title="Calendars">
        <Row
          label="Detailing bay"
          dot="bg-[var(--lab-pos)]"
          checked={filters.bay}
          onChange={(bay) => set({ bay })}
        />
        <Row
          label="Eric"
          dot="bg-[var(--lab-blue)]"
          checked={filters.eric}
          onChange={(eric) => set({ eric })}
        />
      </Group>
      <Group title="Show">
        <Row
          label="Booked"
          checked={filters.booked}
          onChange={(booked) => set({ booked })}
        />
        <Row
          label="Done"
          checked={filters.done}
          onChange={(done) => set({ done })}
        />
        <Row
          label="No-shows"
          checked={filters.noShow}
          onChange={(noShow) => set({ noShow })}
        />
      </Group>
      <Group title="Deposit">
        <Row
          label="Only bookings without a deposit"
          checked={filters.noDepositOnly}
          onChange={(noDepositOnly) => set({ noDepositOnly })}
        />
      </Group>
      <Button
        variant="outline"
        size="sm"
        disabled={!filtersActive(filters)}
        onClick={() => onChange(DEFAULT_FILTERS)}
      >
        Show everything
      </Button>
    </div>
  );
};

/** "Filters" button: a bottom sheet on a phone, a popover on a desktop. */
export const CalendarFilterMenu = ({
  filters,
  onChange,
  mobile,
}: {
  filters: CalendarFilters;
  onChange: (next: CalendarFilters) => void;
  mobile: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const active = filtersActive(filters);
  const trigger = (
    <Button variant="outline" size="sm" aria-label="Filter the calendar">
      <SlidersHorizontal className="size-4" />
      {mobile ? null : "Filters"}
      {active ? (
        <span className="lab-chip lab-chip-eric lab-num">{active}</span>
      ) : null}
    </Button>
  );
  return mobile ? (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85svh] overflow-y-auto rounded-t-2xl px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
      >
        <SheetHeader>
          <SheetTitle>Filter the calendar</SheetTitle>
        </SheetHeader>
        <FilterForm filters={filters} onChange={onChange} />
      </SheetContent>
    </Sheet>
  ) : (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <FilterForm filters={filters} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
};
