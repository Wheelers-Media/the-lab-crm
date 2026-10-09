import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";

/** A list-toolbar filter chip: the toggle button sized for a toolbar, not a sidebar. */
export const QuickFilter = ({
  label,
  value,
}: {
  label: string;
  value: Record<string, unknown>;
}) => (
  <ToggleFilterButton
    label={label}
    value={value}
    className="w-auto border border-border h-9"
  />
);
