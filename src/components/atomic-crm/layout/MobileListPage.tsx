import { ListBase, useListContext, type RaRecord } from "ra-core";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { MobileContent } from "./MobileContent";
import MobileHeader from "./MobileHeader";

const PAGE = 30;

interface MobileListPageProps<T extends RaRecord> {
  resource: string;
  title: string;
  sort: { field: string; order: "ASC" | "DESC" };
  filter?: Record<string, unknown>;
  /** Optional chips or search under the header. */
  toolbar?: ReactNode;
  empty: string;
  renderItem: (record: T) => ReactNode;
}

const Items = <T extends RaRecord>({
  empty,
  renderItem,
}: Pick<MobileListPageProps<T>, "empty" | "renderItem">) => {
  const { data, isPending, total, perPage, setPerPage } = useListContext<T>();
  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (!data?.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">{empty}</p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {data.map((record) => (
        <div key={record.id}>{renderItem(record)}</div>
      ))}
      {total != null && total > data.length ? (
        <Button variant="outline" onClick={() => setPerPage(perPage + PAGE)}>
          Show more ({total - data.length} left)
        </Button>
      ) : null}
    </div>
  );
};

/** A phone list: fixed header, cards, and "show more" instead of pages. */
export const MobileListPage = <T extends RaRecord>({
  resource,
  title,
  sort,
  filter,
  toolbar,
  empty,
  renderItem,
}: MobileListPageProps<T>) => (
  <ListBase
    resource={resource}
    perPage={PAGE}
    sort={sort}
    filter={filter}
    disableSyncWithLocation
    // Keep search, chips and "show more" when coming back to the list
    storeKey={`mobile.${resource}.${title}`}
  >
    <MobileHeader>
      <h1 className="text-xl">{title}</h1>
    </MobileHeader>
    <MobileContent>
      {toolbar ? <div className="mb-3">{toolbar}</div> : null}
      <Items<T> empty={empty} renderItem={renderItem} />
    </MobileContent>
  </ListBase>
);

/** A toggle chip that adds or removes one filter on the current list. */
export const MobileFilterChip = ({
  label,
  value,
}: {
  label: string;
  value: Record<string, unknown>;
}) => {
  const { filterValues, setFilters } = useListContext();
  const keys = Object.keys(value);
  const active = keys.every(
    (k) => JSON.stringify((filterValues ?? {})[k]) === JSON.stringify(value[k]),
  );
  const toggle = () => {
    const next = { ...(filterValues ?? {}) };
    if (active) keys.forEach((k) => delete next[k]);
    else Object.assign(next, value);
    setFilters(next);
  };
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={toggle}
      className={`rounded-md border px-3 py-1.5 text-xs uppercase tracking-wider ${
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
};

/** Search box for a phone list; uses the provider's "q" full-text filter. */
export const MobileSearch = ({ placeholder }: { placeholder: string }) => {
  const { filterValues, setFilters } = useListContext();
  return (
    <input
      type="search"
      defaultValue={(filterValues?.q as string) ?? ""}
      onChange={(e) => {
        const { q: _q, ...rest } = filterValues ?? {};
        setFilters(e.target.value ? { ...rest, q: e.target.value } : rest);
      }}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full h-11 rounded-md border border-input bg-transparent px-3 text-base dark:bg-input/30"
    />
  );
};
