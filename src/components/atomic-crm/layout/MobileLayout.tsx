import { Error } from "@/components/admin/error";
import { Notification } from "@/components/admin/notification";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { DataImportProvider } from "../dataImport/DataImportProvider";
import { useConfigurationLoader } from "../root/useConfigurationLoader";
import { SkipLink } from "../misc/SkipLink";
import { MobileNavigation } from "./MobileNavigation";
import { PullToRefresh } from "./PullToRefresh";
import { ScrollMemory } from "./ScrollMemory";
import { SwipeBack } from "./SwipeBack";

export const MobileLayout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  return (
    <DataImportProvider>
      <SkipLink />
      <PullToRefresh />
      <ScrollMemory />
      <SwipeBack />
      <ErrorBoundary FallbackComponent={Error}>
        <Suspense fallback={<Skeleton className="h-12 w-12 rounded-full" />}>
          {children}
        </Suspense>
      </ErrorBoundary>
      <MobileNavigation />
      <Notification mobileOffset={{ bottom: "72px" }} />
    </DataImportProvider>
  );
};
