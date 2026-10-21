import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export type AsideSectionProps = {
  title: string;
  children?: ReactNode;
  noGap?: boolean;
};

export function AsideSection({ title, children, noGap }: AsideSectionProps) {
  const isMobile = useIsMobile();
  return (
    <div className="mb-6 text-sm">
      <h2
        className={
          isMobile
            ? "text-lg font-semibold normal-case leading-snug"
            : "font-medium pb-1 normal-case leading-snug"
        }
      >
        {title}
      </h2>
      <Separator />
      <div className={cn("pt-2 flex flex-col", { "gap-1": !noGap })}>
        {children}
      </div>
    </div>
  );
}
