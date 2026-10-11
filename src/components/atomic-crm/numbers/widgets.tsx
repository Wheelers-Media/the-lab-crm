import { Download } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { type CsvValue, downloadCsv, toCsv } from "./csv";

/** "+12%" in green, "-8%" in red, nothing when there is nothing to compare with. */
export const Delta = ({ value }: { value: number | null | undefined }) =>
  value == null ? null : (
    <span
      className={cn(
        "lab-num text-xs",
        value >= 0 ? "text-[#3fb27f]" : "text-[#e5484d]",
      )}
    >
      {value >= 0 ? "+" : ""}
      {value.toLocaleString("en-CA")}%
    </span>
  );

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
        <h2 className="text-lg font-semibold text-muted-foreground">{title}</h2>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {actions}
    </div>
    {children}
  </Card>
);

/** A table of rows with the first few shown, the rest on request, and a CSV download. */
export const StatTable = <T,>({
  rows,
  columns,
  rowKey,
  filename,
  limit = 10,
  empty = "Nothing in this period.",
}: {
  rows: T[];
  columns: Array<Column<T>>;
  rowKey: (row: T) => string | number;
  filename?: string;
  limit?: number;
  empty?: string;
}) => {
  const [all, setAll] = useState(false);
  if (!rows.length)
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              {columns.map((c) => (
                <th
                  key={c.header}
                  className={cn(
                    "py-1 pr-3 font-medium whitespace-nowrap",
                    c.numeric ? "text-right" : "text-left",
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => (
                  <td
                    key={c.header}
                    title={c.numeric ? undefined : String(c.value(row) ?? "")}
                    className={cn(
                      "py-1.5 pr-3",
                      c.numeric
                        ? "text-right lab-num whitespace-nowrap"
                        : "max-w-[18rem] truncate",
                    )}
                  >
                    {c.display ? c.display(row) : String(c.value(row) ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
                  rows,
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
