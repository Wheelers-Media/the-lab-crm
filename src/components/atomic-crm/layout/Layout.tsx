import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Notification } from "@/components/admin/notification";
import { Error } from "@/components/admin/error";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { DataImportProvider } from "../dataImport/DataImportProvider";
import { SkipLink } from "../misc/SkipLink";
import { useConfigurationLoader } from "../root/useConfigurationLoader";
import Header from "./Header";
import { PhoneDesktopNotice } from "./PhoneDesktopNotice";
import { ScrollMemory } from "./ScrollMemory";
import { Sidebar, useSidebarRail } from "./Sidebar";

export const Layout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  const { rail, wide, toggle } = useSidebarRail();
  return (
    <DataImportProvider>
      <SkipLink />
      <Sidebar rail={rail} wide={wide} onToggle={toggle} />
      {/* The page makes room for the sidebar: 4rem rail, 16rem when open */}
      <div
        className={cn(
          "transition-[padding] duration-200 motion-reduce:transition-none",
          rail ? "pl-16" : "pl-64",
        )}
      >
        <Header />
        <ScrollMemory />
        <main
          // Fluid: a wide monitor shows more columns, not wider margins
          className="mx-auto w-full max-w-[120rem] px-4 py-4 md:px-6 2xl:px-10"
          id="main-content"
          tabIndex={-1}
        >
          <PhoneDesktopNotice />
          <ErrorBoundary FallbackComponent={Error}>
            <Suspense
              fallback={<Skeleton className="h-12 w-12 rounded-full" />}
            >
              {children}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <Notification />
    </DataImportProvider>
  );
};
