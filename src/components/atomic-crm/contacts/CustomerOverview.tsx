import {
  ArrowRight,
  CalendarPlus,
  FileText,
  Lightbulb,
  MessageSquare,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  AppointmentCreateDialog,
  type AppointmentDefaults,
} from "../calendar/AddAppointment";
import { money } from "../operations/format";
import {
  formatShopDay,
  formatShopTime,
  shopDayKey,
} from "../operations/shopTime";
import { useStartQuote } from "../packages/useStartQuote";
import type { Contact } from "../types";
import { firstPhone } from "./firstPhone";
import { customerSnapshot, type NextSale, nextSales } from "./nextSaleModel";
import { useCustomerHistory, useMembershipPrice } from "./useCustomerHistory";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const Stat = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) => (
  <div className="min-w-0 py-3 sm:px-4 first:sm:pl-0">
    <dt className="lab-eyebrow text-[0.6875rem]">{label}</dt>
    <dd className="mt-1 truncate text-xl font-semibold tabular-nums leading-none">
      {value}
    </dd>
    {detail ? (
      <dd className="mt-1 truncate text-xs text-muted-foreground">{detail}</dd>
    ) : null}
  </div>
);

/**
 * The top of a customer's profile: what they are worth, when they were last
 * in, when they are next in, and what to offer them next. Each suggestion
 * comes with the button that acts on it.
 */
export const CustomerOverview = ({ contact }: { contact: Contact }) => {
  const now = useMemo(() => new Date(), []);
  const history = useCustomerHistory(contact.id);
  const membershipPrice = useMembershipPrice();
  const [bookOpen, setBookOpen] = useState(false);
  const [bookDefaults, setBookDefaults] = useState<AppointmentDefaults>({
    day: shopDayKey(now),
  });

  const snapshot = useMemo(
    () => customerSnapshot(history.orders, history.appointments, now),
    [history.orders, history.appointments, now],
  );
  const suggestions = useMemo(
    () =>
      nextSales({
        orders: history.orders,
        appointments: history.appointments,
        deals: history.deals,
        membership: contact.membership,
        membershipPrice,
        now,
      }),
    [
      history.orders,
      history.appointments,
      history.deals,
      contact.membership,
      membershipPrice,
      now,
    ],
  );

  const book = (title?: string) => {
    setBookDefaults({
      day: shopDayKey(now),
      contact_id: contact.id,
      vehicle: contact.vehicle_label,
      title,
    });
    setBookOpen(true);
  };

  if (history.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  const next = snapshot.nextVisit;
  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-x-4 border-y border-border sm:grid-cols-4 sm:gap-x-0 sm:divide-x sm:divide-border">
        <Stat
          label="Lifetime"
          value={money(snapshot.lifetimeSpend)}
          detail={`${snapshot.orders} ${snapshot.orders === 1 ? "order" : "orders"}`}
        />
        <Stat
          label="Visits"
          value={String(snapshot.visits)}
          detail={
            snapshot.noShows
              ? `${snapshot.noShows} no-show${snapshot.noShows === 1 ? "" : "s"}`
              : "Appointments kept"
          }
        />
        <Stat
          label="Last in"
          value={snapshot.lastVisit ? shortDate(snapshot.lastVisit) : "Never"}
        />
        <Stat
          label="Next in"
          value={
            next
              ? formatShopDay(shopDayKey(next.start_at), {
                  month: "short",
                  day: "numeric",
                })
              : "Not booked"
          }
          detail={
            next
              ? `${formatShopTime(next.start_at)} · ${next.title}`
              : undefined
          }
        />
      </dl>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
        <NextSaleList
          contact={contact}
          suggestions={suggestions}
          onBook={book}
        />
        <section aria-labelledby="next-visit" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2
              id="next-visit"
              className="text-base font-semibold normal-case leading-snug"
            >
              Next appointment
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => book()}
            >
              <CalendarPlus className="size-4" />
              Book
            </Button>
          </div>
          {next ? (
            <Link
              to={`/calendar?date=${shopDayKey(next.start_at)}&view=day`}
              className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-foreground/40"
            >
              <span className="grid w-12 shrink-0 place-items-center rounded-md bg-muted py-1.5 text-center leading-none">
                <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                  {formatShopDay(shopDayKey(next.start_at), { month: "short" })}
                </span>
                <span className="mt-0.5 text-lg font-semibold tabular-nums">
                  {formatShopDay(shopDayKey(next.start_at), { day: "numeric" })}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {next.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {formatShopDay(shopDayKey(next.start_at), {
                    weekday: "long",
                  })}{" "}
                  {formatShopTime(next.start_at)} ·{" "}
                  {next.resource === "eric" ? "With Eric" : "Detailing bay"}
                  {next.deposit_paid ? "" : " · No deposit yet"}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
              Nothing booked. Book a drop-off or a time with Eric from here.
            </p>
          )}
        </section>
      </div>

      {bookOpen ? (
        <AppointmentCreateDialog
          open={bookOpen}
          onOpenChange={setBookOpen}
          defaults={bookDefaults}
        />
      ) : null}
    </div>
  );
};

const ACTION: Record<
  NextSale["action"],
  { label: string; Icon: typeof FileText }
> = {
  quote: { label: "Quote", Icon: FileText },
  "open-quote": { label: "Open", Icon: FileText },
  book: { label: "Book", Icon: CalendarPlus },
  text: { label: "Text", Icon: MessageSquare },
};

const NextSaleList = ({
  contact,
  suggestions,
  onBook,
}: {
  contact: Contact;
  suggestions: NextSale[];
  onBook: (title?: string) => void;
}) => {
  const navigate = useNavigate();
  const { startQuote, isStarting } = useStartQuote();
  const phone = firstPhone(contact);

  const act = (sale: NextSale) => {
    if (sale.action === "open-quote" && sale.dealId != null) {
      navigate(`/quotes/${sale.dealId}`);
    } else if (sale.action === "quote") {
      startQuote(contact);
    } else if (sale.action === "book") {
      onBook(sale.id === "detail-due" ? "Signature detail" : undefined);
    } else if (sale.action === "text" && phone) {
      window.location.href = `sms:${phone.replace(/[^\d+]/g, "")}`;
    }
  };

  return (
    <section aria-labelledby="next-sale" className="flex flex-col gap-2">
      <h2
        id="next-sale"
        className="flex min-h-9 items-center gap-2 text-base font-semibold normal-case leading-snug"
      >
        <Lightbulb className="size-4 text-[var(--lab-amber)]" aria-hidden />
        Next sale
      </h2>
      {suggestions.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {suggestions.map((sale) => {
            const { label, Icon } = ACTION[sale.action];
            const disabled =
              (sale.action === "text" && !phone) ||
              (sale.action === "quote" && isStarting);
            return (
              <li key={sale.id} className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">
                    {sale.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground text-pretty">
                    {sale.reason}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={sale.action === "text" ? "outline" : "secondary"}
                  disabled={disabled}
                  onClick={() => act(sale)}
                  className={cn(
                    "shrink-0 active:scale-[0.97]",
                    sale.action !== "text" &&
                      "bg-[color-mix(in_oklab,var(--lab-blue)_18%,transparent)] text-[var(--lab-blue-text)] hover:bg-[color-mix(in_oklab,var(--lab-blue)_28%,transparent)]",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          Nothing to offer right now: they are booked in, quoted or up to date.
        </p>
      )}
    </section>
  );
};
