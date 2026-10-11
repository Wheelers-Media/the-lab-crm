import type { LucideIcon } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";

export type SheetAction = {
  label: string;
  icon?: LucideIcon;
  onSelect: (event: React.MouseEvent) => void;
  destructive?: boolean;
  /** Shown but not tappable, e.g. "Call" for a customer with no phone. */
  disabled?: boolean;
};

/**
 * An iOS-style action sheet: slides up from the bottom, swipe down or tap
 * Cancel to close. Used for tap-and-hold menus on list rows.
 */
export const ActionSheet = ({
  open,
  onOpenChange,
  title,
  subtitle,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  actions: SheetAction[];
}) => (
  <Drawer open={open} onOpenChange={onOpenChange}>
    <DrawerContent className="border-0 bg-transparent px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] [&>div:first-child]:bg-white/30">
      <div className="mt-3 overflow-hidden rounded-2xl bg-card">
        <div className="flex flex-col items-center gap-0.5 px-6 py-3.5 text-center">
          <DrawerTitle className="text-sm font-semibold text-foreground line-clamp-2">
            {title}
          </DrawerTitle>
          <DrawerDescription
            className={subtitle ? "text-xs text-muted-foreground" : "sr-only"}
          >
            {subtitle ?? "Actions"}
          </DrawerDescription>
        </div>
        <ul className="divide-y divide-border border-t border-border">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.label}>
                <button
                  type="button"
                  disabled={action.disabled}
                  onClick={(event) => {
                    onOpenChange(false);
                    action.onSelect(event);
                  }}
                  className={`flex min-h-14 w-full items-center justify-center gap-3 px-5 text-[1.0625rem] transition-colors active:bg-muted disabled:opacity-40 ${
                    action.destructive ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {Icon ? <Icon className="size-5" aria-hidden /> : null}
                  {action.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="mt-2 min-h-14 w-full rounded-2xl bg-card text-[1.0625rem] font-semibold transition-colors active:bg-muted"
      >
        Cancel
      </button>
    </DrawerContent>
  </Drawer>
);
