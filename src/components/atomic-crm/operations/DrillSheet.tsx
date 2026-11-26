import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

/** One record behind a number: it opens its own page (`to`) or a pop-up (`onOpen`). */
export interface DrillRow {
  key: string | number;
  title: ReactNode;
  subtitle?: ReactNode;
  /** The figure on the right: money, a date, a status. */
  value?: ReactNode;
  to?: string;
  onOpen?: () => void;
}

/** Everything a tile shows when tapped: what the number is, and the records it counts. */
export interface DrillContent {
  title: string;
  /** What the number is and how it was worked out, in plain words. */
  description?: string;
  rows: DrillRow[];
  empty?: string;
  /** Extra controls or totals above the list. */
  header?: ReactNode;
}

const RowBody = ({ row }: { row: DrillRow }) => (
  <>
    <span className="flex min-w-0 flex-1 flex-col text-left">
      <span className="truncate text-[15px] font-medium text-foreground">
        {row.title}
      </span>
      {row.subtitle ? (
        <span className="truncate text-xs text-muted-foreground">
          {row.subtitle}
        </span>
      ) : null}
    </span>
    {row.value ? (
      <span className="lab-num shrink-0 text-sm font-medium">{row.value}</span>
    ) : null}
    {row.to || row.onOpen ? (
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
    ) : null}
  </>
);

const ROW_CLASS = "flex min-h-14 w-full items-center gap-3 px-4 py-2.5";

/**
 * The detail behind any tile: a sheet listing the exact records that make up
 * the number, each one a tap away from its own page. Shared by Numbers, Home
 * and the lists so every figure can be followed down to the records.
 */
export const DrillSheet = ({
  drill,
  onClose,
}: {
  drill: DrillContent | null;
  onClose: () => void;
}) => {
  const isMobile = useIsMobile();
  const rows = drill?.rows ?? [];
  return (
    <Sheet open={drill != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "max-h-[85dvh] overflow-y-auto"
            : "w-full overflow-y-auto sm:max-w-md"
        }
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>{drill?.title}</SheetTitle>
          <SheetDescription>
            {rows.length} {rows.length === 1 ? "record" : "records"}
            {drill?.description ? `. ${drill.description}` : ""}
          </SheetDescription>
        </SheetHeader>
        {drill?.header ? <div className="px-4">{drill.header}</div> : null}
        {rows.length ? (
          <ul className="divide-y divide-border pb-6">
            {rows.map((row) => (
              <li key={row.key}>
                {row.to ? (
                  <Link
                    to={row.to}
                    onClick={onClose}
                    className={`${ROW_CLASS} hover:bg-muted/50`}
                  >
                    <RowBody row={row} />
                  </Link>
                ) : row.onOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      row.onOpen?.();
                    }}
                    className={`${ROW_CLASS} hover:bg-muted/50`}
                  >
                    <RowBody row={row} />
                  </button>
                ) : (
                  <div className={ROW_CLASS}>
                    <RowBody row={row} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 pb-6 text-sm text-muted-foreground">
            {drill?.empty ?? "Nothing behind this number."}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
};
