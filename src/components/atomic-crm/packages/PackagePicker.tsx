import { Plus } from "lucide-react";
import { useGetList } from "ra-core";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Package } from "../types";
import { packagePriceLabel } from "./packageModel";

const NOT_FOR_JOBS = /secure booking deposit/i;

/**
 * The live catalog (anything Shopify has not deleted), grouped by service:
 * shop packages first, then Parts Store products for parts-and-install jobs.
 */
export const usePackageGroups = () => {
  const { dealCategories } = useConfigurationContext();
  const { data = [], isPending } = useGetList<Package>("packages", {
    pagination: { page: 1, perPage: 2000 },
    sort: { field: "title", order: "ASC" },
    filter: { "status@neq": "deleted" },
  });
  const groups = useMemo(() => {
    const labelOf = (value: string | null) =>
      dealCategories.find((c) => c.value === value)?.label ?? "Other";
    const map = new Map<string, Package[]>();
    for (const pkg of data) {
      if (NOT_FOR_JOBS.test(pkg.title)) continue;
      const label =
        pkg.kind === "product"
          ? `Parts Store: ${labelOf(pkg.category)}`
          : labelOf(pkg.category);
      map.set(label, [...(map.get(label) ?? []), pkg]);
    }
    const order = dealCategories.map((c) => c.label);
    const rank = (label: string) =>
      (label.startsWith("Parts Store") ? 100 : 0) +
      (order.indexOf(label.replace(/^Parts Store: /, "")) + 1 || 99);
    return [...map.entries()].sort(([a], [b]) => rank(a) - rank(b));
  }, [data, dealCategories]);
  return { groups, isPending, count: data.length };
};

/** Searchable package list in a popover; calls onPick with the package. */
export const PackagePicker = ({
  onPick,
  label = "Add package",
}: {
  onPick: (pkg: Package) => void;
  label?: string;
}) => {
  const [open, setOpen] = useState(false);
  const { groups, isPending } = usePackageGroups();
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        {/* The popover trigger replaces the button's data-slot, so restate the site button type */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="uppercase font-bold tracking-[0.07em] text-[0.8125rem]"
        >
          <Plus className="size-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[min(28rem,calc(100vw-2rem))]"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search tint, detail, bumper, part..." />
          <CommandList className="max-h-80">
            <CommandEmpty>
              {isPending
                ? "Loading packages..."
                : "No package found. Add it as a custom line."}
            </CommandEmpty>
            {groups.map(([group, packages]) => (
              <CommandGroup key={group} heading={group}>
                {packages.map((pkg) => (
                  <CommandItem
                    key={pkg.id}
                    value={`${pkg.title} ${group} ${pkg.id}`}
                    onSelect={() => {
                      onPick(pkg);
                      setOpen(false);
                    }}
                    className="flex justify-between gap-3"
                  >
                    <span className="truncate">{pkg.title}</span>
                    <span className="text-xs text-muted-foreground lab-num shrink-0">
                      {packagePriceLabel(pkg)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
