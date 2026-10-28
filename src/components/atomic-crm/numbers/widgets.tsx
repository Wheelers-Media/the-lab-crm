import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { type CsvValue, downloadCsv, toCsv } from "./csv";

/** "+12%" in green, "-8%" in red, nothing when there is nothing to compare with. */
export const Delta = ({ value: raw }: { value: number | null | undefined }) => {
  if (raw == null) return null;
  // A change that rounds to nothing is "0%", never "-0%"
  const value = raw === 0 ? 0 : raw;
  return (
    <span
      className={cn(
        "lab-num text-xs",
        value === 0
          ? "text-muted-foreground"
          : value > 0
            ? "text-[var(--lab-pos)]"
            : "text-[var(--lab-neg)]",
      )}
    >
      {/* The arrow carries the direction for anyone who cannot see the hue */}
      {value > 0 ? (
        <ArrowUp className="inline size-3" aria-hidden="true" />
      ) : value < 0 ? (
        <ArrowDown className="inline size-3" aria-hidden="true" />
      ) : null}
      {Math.abs(value).toLocaleString("en-CA")}%
    </span>
  );
};

export interface Column<T> {
  header: string;
  /** The raw value: sorted and exported as is. */
  value: (row: T) => CsvValue;
  /** What to show when it differs from the raw value (money, links). */
  display?: (row: T) => ReactNode;
  numeric?: boolean;
}

export const SectionCard = ({
  title,
  hint,
  children,
  actions,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  actions?: ReactNode;
}) => (
  <Card className="p-4 gap-3 min-w-0">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {hint ? (
          <p className="hidden text-xs text-muted-foreground sm:block">
            {hint}
          </p>
        ) : null}
      </div>
      {actions}
    </div>
    {children}
  </Card>
);

interface SortState {
  header: string;
  dir: "asc" | "desc";
}

/**
 * A table of rows with the first few shown, the rest on request, a CSV
 * download, headers that sort, and (when `onRowClick` is given) rows that act
 * as buttons, for filtering the rest of the screen by that row.
 */
/**
 * A table read on a phone is a list, as in a native app: the name on the
 * left, the headline figure on the right, the other columns as one quiet
 * caption line underneath. No sideways scrolling to find a number.
 */
const PhoneRows = <T,>({
  rows,
  columns,
  rowKey,
  onRowClick,
  isSelected,
}: {
  rows: T[];
  columns: Array<Column<T>>;
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  isSelected?: (row: T) => boolean;
}) => {
  const [title, ...rest] = columns;
  // The money column leads when there is one: it is what people scan for
  const lead =
    rest.find(
      (c) => c.numeric && /spend|sales|revenue|value|total|\$/i.test(c.header),
    ) ?? rest.find((c) => c.numeric);
  const others = rest.filter((c) => c !== lead);
  const show = (c: Column<T>, row: T) =>
    c.display ? c.display(row) : String(c.value(row) ?? "");
  return (
    <ul className="-mx-4 divide-y divide-border border-y border-border">
      {rows.map((row) => {
        const selected = isSelected?.(row) ?? false;
        const inner = (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-medium text-foreground">
                {show(title, row)}
              </span>
              {others.length ? (
                <span className="truncate text-[13px] text-muted-foreground">
                  {others.map((c, i) => (
                    <span key={c.header}>
                      {i ? " · " : ""}
                      {c.header} <span className="lab-num">{show(c, row)}</span>
                    </span>
                  ))}
                </span>
              ) : null}
            </span>
            {lead ? (
              <span className="lab-num shrink-0 text-right text-[15px] font-semibold">
                {show(lead, row)}
              </span>
            ) : null}
          </>
        );
        return (
          <li key={rowKey(row)}>
            {onRowClick ? (
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onRowClick(row)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left active:bg-muted",
                  selected && "bg-muted",
                )}
              >
                {inner}
              </button>
            ) : (
              <div className="flex min-h-12 items-center gap-3 px-4 py-2">
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export const StatTable = <T,>({
  rows,
  columns,
  rowKey,
  filename,
  limit = 10,
  empty = "Nothing in this period.",
  onRowClick,
  isSelected,
}: {
  rows: T[];
  columns: Array<Column<T>>;
  rowKey: (row: T) => string | number;
  filename?: string;
  limit?: number;
  empty?: string;
  onRowClick?: (row: T) => void;
  isSelected?: (row: T) => boolean;
}) => {
  const isMobile = useIsMobile();
  const [all, setAll] = useState(false);
  const [sort, setSort] = useState<SortState | null>(null);

  const sorted = useMemo(() => {
    const column = sort && columns.find((c) => c.header === sort.header);
    if (!sort || !column) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = column.value(a);
      const y = column.value(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const order =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y));
      return order * dir;
    });
  }, [rows, columns, sort]);

  if (!rows.length)
    return <p className="text-sm text-muted-foreground">{empty}</p>;

  // Numbers start high to low (what you want to see), text starts A to Z
  const nextSort = (c: Column<T>): SortState | null => {
    if (sort?.header !== c.header)
      return { header: c.header, dir: c.numeric ? "desc" : "asc" };
    const first = c.numeric ? "desc" : "asc";
    return sort.dir === first
      ? { header: c.header, dir: first === "desc" ? "asc" : "desc" }
      : null;
  };

  const shown = all ? sorted : sorted.slice(0, limit);
  return (
    <div className="flex flex-col gap-2">
      {isMobile ? (
        <PhoneRows
          rows={shown}
          columns={columns}
          rowKey={rowKey}
          onRowClick={onRowClick}
          isSelected={isSelected}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                {columns.map((c) => {
                  const active = sort?.header === c.header;
                  return (
                    <th
                      key={c.header}
                      aria-sort={
                        active
                          ? sort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      className={cn(
                        "py-1 pr-3 font-medium whitespace-nowrap",
                        c.numeric ? "text-right" : "text-left",
                        // The name column stays put while the numbers scroll
                        columns.indexOf(c) === 0 &&
                          "sticky left-0 z-[1] bg-card",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSort(nextSort(c))}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm hover:text-foreground",
                          active && "text-foreground",
                        )}
                      >
                        {c.header}
                        {active ? (
                          sort.dir === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((row) => {
                const selected = isSelected?.(row) ?? false;
                return (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      onRowClick && "cursor-pointer hover:bg-muted/60",
                      selected && "bg-muted",
                    )}
                  >
                    {columns.map((c, i) => {
                      const content = c.display
                        ? c.display(row)
                        : String(c.value(row) ?? "");
                      return (
                        <td
                          key={c.header}
                          title={
                            c.numeric ? undefined : String(c.value(row) ?? "")
                          }
                          className={cn(
                            "py-1.5 pr-3",
                            c.numeric
                              ? "text-right lab-num whitespace-nowrap"
                              : "max-w-[18rem] truncate",
                            i === 0 &&
                              "sticky left-0 z-[1] max-w-[11rem] bg-card sm:max-w-[18rem]",
                            i === 0 && selected && "bg-muted",
                          )}
                        >
                          {onRowClick && i === 0 ? (
                            <button
                              type="button"
                              aria-pressed={selected}
                              onClick={(e) => {
                                e.stopPropagation();
                                onRowClick(row);
                              }}
                              className="max-w-full truncate rounded-sm text-left underline-offset-4 hover:underline"
                            >
                              {content}
                            </button>
                          ) : (
                            content
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between">
        {rows.length > limit ? (
          <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>
            {all ? "Show fewer" : `Show all ${rows.length}`}
          </Button>
        ) : (
          <span />
        )}
        {filename ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() =>
              downloadCsv(
                filename,
                toCsv(
                  sorted,
                  columns.map((c) => ({ label: c.header, value: c.value })),
                ),
              )
            }
          >
            <Download className="size-3.5" />
            CSV
          </Button>
        ) : null}
      </div>
    </div>
  );
};
