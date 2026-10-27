import { useMutation } from "@tanstack/react-query";
import { CalendarSync, TriangleAlert } from "lucide-react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import { formatShopTime } from "../operations/shopTime";
import type { GoogleCalendarSyncResult } from "../providers/commons/googleCalendarSync";
import type { CrmDataProvider } from "../providers/types";

const STORAGE_KEY = "googleCalendarSyncedAt";
// Opening the Calendar syncs unless it ran in the last few minutes
const FRESH_MS = 5 * 60_000;

const readSyncedAt = (): number => {
  try {
    return Number(sessionStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
};

const summary = (r: GoogleCalendarSyncResult): string => {
  const parts: string[] = [];
  if (r.pulled?.created) parts.push(`${r.pulled.created} new from Google`);
  if (r.pulled?.updated) parts.push(`${r.pulled.updated} changed`);
  if (r.pulled?.cancelled) parts.push(`${r.pulled.cancelled} cancelled`);
  if (r.linked) parts.push(`${r.linked} linked to a customer`);
  if (r.pushed?.created) parts.push(`${r.pushed.created} sent to Google`);
  if (r.pushed?.updated) parts.push(`${r.pushed.updated} moved in Google`);
  if (r.pushed?.deleted) parts.push(`${r.pushed.deleted} removed from Google`);
  return parts.length ? parts.join(", ") : "up to date";
};

/**
 * Keeps the CRM calendar and the shop's Google calendars in step: syncs when
 * the Calendar opens, and on request. Quiet until the Google key is set.
 */
export const GoogleCalendarSync = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [result, setResult] = useState<GoogleCalendarSyncResult | null>(null);
  const { mutate, isPending } = useMutation({
    mutationFn: () => dataProvider.syncGoogleCalendar(),
    onSuccess: (r) => {
      setResult(r);
      if (!r.configured || r.busy) return;
      try {
        sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        // private mode: the sync just runs again next time
      }
      const changed =
        (r.pulled?.created ?? 0) +
        (r.pulled?.updated ?? 0) +
        (r.pulled?.cancelled ?? 0) +
        (r.linked ?? 0);
      if (changed > 0) refresh();
    },
    onError: (error: Error) => notify(error.message, { type: "error" }),
  });

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (Date.now() - readSyncedAt() > FRESH_MS) mutate();
  }, [mutate]);

  const problems = result?.calendars?.filter((c) => !c.ok) ?? [];
  // Not connected yet: a short note, the steps are in the docs
  const notConnected = result != null && !result.configured && !isPending;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"
      aria-live="polite"
    >
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => mutate()}
        aria-label="Sync Google Calendar"
      >
        <CalendarSync
          className={isPending ? "size-4 animate-spin" : "size-4"}
        />
        Google Calendar
      </Button>
      {isPending ? <span>Syncing...</span> : null}
      {result?.busy && !isPending ? (
        <span>A sync just ran. Try again in a minute.</span>
      ) : null}
      {result?.configured && !isPending && !result.busy ? (
        <span>
          Synced {result.syncedAt ? formatShopTime(result.syncedAt) : "now"}:{" "}
          {summary(result)}
          {result.skipped?.allDay
            ? `. ${result.skipped.allDay} all-day ${result.skipped.allDay === 1 ? "entry" : "entries"} left out`
            : ""}
        </span>
      ) : null}
      {notConnected ? (
        <span>
          Not connected yet. Setup steps are in docs/google-calendar-setup.md.
        </span>
      ) : null}
      {problems.map((p) => (
        <span
          key={p.name}
          className="inline-flex items-center gap-1 text-destructive"
        >
          <TriangleAlert className="size-4" />
          {p.name}: {p.error}
        </span>
      ))}
    </div>
  );
};
