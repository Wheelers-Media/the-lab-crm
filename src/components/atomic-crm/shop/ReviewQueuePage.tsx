import { RecordContextProvider, useGetList } from "ra-core";
import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import type { Order } from "../types";
import { ContactLink } from "./ContactLink";
import {
  canAskReview,
  isDueForReview,
  reviewTiming,
  wasAsked,
} from "./orderReview";
import { ReviewAskButton } from "./ReviewAskButton";
import { useAskedReviews } from "./ReviewAskDialog";
import { formatMoney, orderNet, summarizeLines } from "./shopFormat";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

/**
 * Who to ask for a review: paid orders from the last 30 days nobody has asked
 * about yet. Texts go out in the evening, when customers are home, so this
 * page says whether now is a good time and each row can set a 6 p.m. reminder.
 */
export const ReviewQueuePage = () => {
  const {
    data = [],
    isPending,
    error,
    refetch,
  } = useGetList<Order>("orders", {
    sort: { field: "ordered_at", order: "DESC" },
    pagination: { page: 1, perPage: 300 },
    filter: { "cancelled_at@is": null, is_deposit: false },
  });
  const asked = useAskedReviews();
  const now = new Date();
  const queue = data.filter(
    (o) => canAskReview(o) && isDueForReview(o, now) && !wasAsked(o, asked),
  );
  const timing = reviewTiming(now);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ask for reviews</h2>
        <p className="text-sm text-muted-foreground">
          Paid orders from the last 30 days that haven't been asked yet. Texts
          wait for the evening so people are home, not driving.
        </p>
      </div>
      <p
        className={`rounded-md border p-3 text-sm ${
          timing.good
            ? "border-[var(--lab-bay,currentColor)]"
            : "border-[var(--lab-amber,currentColor)]"
        }`}
      >
        {timing.label}
      </p>
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-[var(--lab-neg,currentColor)] p-3 text-sm"
        >
          Couldn't load recent orders, so this list isn't trustworthy.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void refetch()}
          >
            Try again
          </button>
        </div>
      ) : isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : queue.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Everyone from the last 30 days has been asked. Nice work.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {queue.map((order) => (
            <li key={order.id}>
              <RecordContextProvider value={order}>
                <Card className="flex-row items-center gap-3 p-3">
                  <Star
                    className="size-4 shrink-0 text-[var(--lab-amber)]"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      <ContactLink />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {summarizeLines(order.line_items, 2)}
                    </p>
                    <p className="text-xs text-muted-foreground lab-num">
                      Order {order.order_number} · {shortDate(order.ordered_at)}{" "}
                      · {formatMoney(orderNet(order), order.currency)}
                    </p>
                  </div>
                  <ReviewAskButton order={order} />
                </Card>
              </RecordContextProvider>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
