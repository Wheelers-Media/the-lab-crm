import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";

export const Status = ({
  status,
  className,
  withLabel = false,
}: {
  status: string;
  className?: string;
  /** Show the word beside the dot, where there is no hover to reveal it (phones). */
  withLabel?: boolean;
}) => {
  const { noteStatuses } = useConfigurationContext();
  if (!status || !noteStatuses) return null;
  const statusObject = noteStatuses.find((s: any) => s.value === status);

  if (!statusObject) return null;
  if (withLabel) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground",
          className,
        )}
      >
        <span
          className="inline-block size-2 rounded-full"
          style={{ backgroundColor: statusObject.color }}
          aria-hidden
        />
        {statusObject.label}
      </span>
    );
  }
  return (
    <div className={cn("group relative inline-block mr-2", className)}>
      <span
        className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: statusObject.color }}
      />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
        {statusObject.label}
      </div>
    </div>
  );
};
