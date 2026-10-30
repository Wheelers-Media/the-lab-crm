import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

import { type PushKind, usePushNotifications } from "./usePushNotifications";

const KINDS: Array<{ kind: PushKind; label: string; hint: string }> = [
  {
    kind: "lead",
    label: "New leads",
    hint: "A quote or booking request from the website",
  },
  {
    kind: "booking",
    label: "Bookings",
    hint: "Cal.com booked, moved or cancelled a time",
  },
  {
    kind: "deposit",
    label: "Deposits paid",
    hint: "A $50 booking deposit came in",
  },
  { kind: "order", label: "Shop orders", hint: "A Shopify order was paid" },
];

/** Alerts for this phone or computer. Each device chooses for itself. */
export const NotificationsCard = () => {
  const { state, prefs, error, busy, enable, disable, setKind } =
    usePushNotifications();

  return (
    <Card id="notifications">
      <CardContent className="space-y-4">
        <h2 className="text-xl font-semibold text-muted-foreground">
          Notifications
        </h2>

        {state === "loading" ? (
          <p className="text-sm text-muted-foreground">Checking this device…</p>
        ) : null}

        {state === "unsupported" ? (
          <p className="text-sm text-muted-foreground">
            This browser can't show alerts. On an iPhone, add the app to your
            Home Screen first, then open it from there.
          </p>
        ) : null}

        {state === "blocked" ? (
          <p className="text-sm text-muted-foreground">
            Alerts are blocked for this app. Allow notifications for THE LAB CRM
            in your phone's settings, then come back here.
          </p>
        ) : null}

        {state === "off" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Get an alert on this device the moment something comes in: a new
              lead, a booking, a deposit or an order. Tap one to open it.
            </p>
            <Button type="button" onClick={enable} disabled={busy}>
              <Bell className="size-4" />
              Turn on alerts
            </Button>
          </>
        ) : null}

        {state === "on" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Alerts are on for this device. Choose what you want to hear about.
            </p>
            <ul className="divide-y">
              {KINDS.map(({ kind, label, hint }) => (
                <li key={kind}>
                  <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-2">
                    <span>
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {hint}
                      </span>
                    </span>
                    <Switch
                      checked={prefs[kind] !== false}
                      onCheckedChange={(on) => setKind(kind, on)}
                    />
                  </label>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={disable}
              disabled={busy}
            >
              <BellOff className="size-4" />
              Turn off alerts on this device
            </Button>
          </>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};
