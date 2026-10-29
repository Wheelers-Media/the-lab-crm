import { Check, UserX } from "lucide-react";
import { type Identifier, useNotify, useUpdate } from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { Appointment, Contact } from "../types";
import { contactName } from "./format";
import { formatShopDay, formatShopTime, shopDayKey } from "./shopTime";

type Answer = "completed" | "no_show";

/**
 * Last week's bookings nobody settled: one tap each for Showed or No-show.
 * A payment around the booking day settles a booking on its own, so this
 * only holds the ones that need a person.
 */
export const ShowCheckSheet = ({
  open,
  onOpenChange,
  bookings,
  contactsById,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookings: Appointment[];
  contactsById: Map<Identifier, Contact>;
}) => {
  const [update] = useUpdate<Appointment>();
  const notify = useNotify();
  // Answered here, so a row leaves the list the moment it is tapped
  const [answered, setAnswered] = useState<Set<Identifier>>(new Set());
  const left = bookings.filter((b) => !answered.has(b.id));

  const answer = (booking: Appointment, status: Answer) => {
    setAnswered((previous) => new Set(previous).add(booking.id));
    update(
      "appointments",
      { id: booking.id, data: { status }, previousData: booking },
      {
        mutationMode: "pessimistic",
        onError: () => {
          setAnswered((previous) => {
            const next = new Set(previous);
            next.delete(booking.id);
            return next;
          });
          notify("Could not save that. Try again.", { type: "error" });
        },
        onSuccess: () => {
          if (left.length <= 1) onOpenChange(false);
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-2xl pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
      >
        <SheetHeader className="pr-12">
          <SheetTitle>Did they show?</SheetTitle>
          <SheetDescription>
            Last week's bookings with no payment around the day. Showed marks
            the visit done; No-show marks it missed.
          </SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col divide-y divide-border px-4">
          {left.map((booking) => {
            const contact =
              booking.contact_id != null
                ? contactsById.get(booking.contact_id)
                : undefined;
            const day = shopDayKey(booking.start_at);
            return (
              <li key={booking.id} className="flex flex-col gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {booking.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatShopDay(day, { weekday: "short", day: "numeric" })}{" "}
                    {formatShopTime(booking.start_at)}
                    {contact ? ` · ${contactName(contact)}` : ""}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => answer(booking, "completed")}
                  >
                    <Check className="size-4" aria-hidden />
                    Showed
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => answer(booking, "no_show")}
                  >
                    <UserX className="size-4" aria-hidden />
                    No-show
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        {!left.length ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            All settled.
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};
