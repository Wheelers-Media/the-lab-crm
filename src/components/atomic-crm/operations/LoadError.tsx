import { RotateCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Shown in place of figures that failed to load. Without it a failed load
 * read as a quiet day: $0 taken and nothing needing attention.
 */
export const LoadError = ({ onRetry }: { onRetry: () => void }) => (
  <Card className="items-start gap-3 p-4" role="alert">
    <div className="flex items-start gap-3">
      <WifiOff
        className="mt-0.5 size-5 shrink-0 text-[var(--lab-neg)]"
        aria-hidden
      />
      <div>
        <h2 className="text-base font-semibold">
          Couldn't load the shop's numbers
        </h2>
        <p className="text-sm text-muted-foreground">
          The figures are hidden so a failed load doesn't look like a quiet day.
          Check the connection, then try again.
        </p>
      </div>
    </div>
    <Button type="button" onClick={onRetry} className="min-h-11">
      <RotateCw className="size-4" aria-hidden />
      Try again
    </Button>
  </Card>
);
