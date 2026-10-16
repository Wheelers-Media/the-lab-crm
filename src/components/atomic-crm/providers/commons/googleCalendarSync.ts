/** What one run of the Google Calendar sync did (see google_calendar_sync). */
export type GoogleCalendarSyncResult = {
  /** False until the service account key is set on the Supabase project. */
  configured: boolean;
  /** Another screen's sync was running; nothing was done. */
  busy?: boolean;
  message?: string;
  calendars?: Array<{ name: string; ok: boolean; error?: string }>;
  pulled?: { created: number; updated: number; cancelled: number };
  pushed?: { created: number; updated: number; deleted: number };
  skipped?: { allDay: number; calcom: number; invalid: number };
  syncedAt?: string;
};

export class GoogleCalendarSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleCalendarSyncError";
  }
}
