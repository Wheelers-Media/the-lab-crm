import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Chrome for the custom full-page screens (Calendar, Numbers, Shop floor,
 * Quote builder). On a phone these routes sit outside the list and show
 * shell, so without this they render under the notch, with no `main`
 * landmark for the skip link, and with no clearance for the tab bar.
 * On a desktop the CRM layout already provides all of that.
 */
export const MobilePage = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const isMobile = useIsMobile();
  if (!isMobile) return <>{children}</>;
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn(
        "lab-page-in mx-auto max-w-screen-xl px-4 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] outline-none",
        className,
      )}
    >
      {children}
    </main>
  );
};
