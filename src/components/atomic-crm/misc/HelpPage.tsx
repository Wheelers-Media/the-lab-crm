import { Link } from "react-router";
import { Card } from "@/components/ui/card";

import { PAGES } from "../layout/navigation";

const STEPS: Array<[string, string]> = [
  [
    "Intake",
    "A request comes in from the website, a call or a text. Add the customer and their truck.",
  ],
  [
    "Quoted",
    "Build the quote from the Jobs card (parts, power package, labour). Text or email the checkout link.",
  ],
  [
    "Booked",
    "The deposit is paid or a time is picked. It shows on the Calendar.",
  ],
  [
    "In the shop",
    "On the day, tap Arrived on the job. The Shop floor controls only appear for trucks that are here today.",
  ],
  [
    "Ready for pickup",
    "Tap Ready and send the ready text. After 2 days nobody has picked up, Home reminds you.",
  ],
  ["Picked up", "Tap Picked up. The customer lands in Ask for reviews."],
  [
    "Ask for a review",
    "In the evening, when they are home, text the review ask from Orders or Ask for reviews.",
  ],
];

const FIND: Array<[string, string, string]> = [
  ["What is on today?", PAGES.home.to, "Home"],
  ["Who is dropping off, and when?", PAGES.calendar.to, "Calendar"],
  ["Which trucks are in the shop right now?", PAGES.shopFloor.to, "Shop floor"],
  [
    "Which jobs are new, which are going stale?",
    PAGES.jobs.to,
    "Jobs (newest first in every column)",
  ],
  ["Everything about one customer", PAGES.customers.to, "Customers"],
  ["Who bought something? Ask them for a review", PAGES.orders.to, "Orders"],
  [
    "Who still needs a review ask tonight?",
    PAGES.reviews.to,
    "Ask for reviews",
  ],
  [
    "Who left items in their cart?",
    PAGES.carts.to,
    "Abandoned carts (click a cart for details)",
  ],
  [
    "What do we sell, and what is in stock?",
    PAGES.packages.to,
    "Packages and products",
  ],
  ["How is the month going?", PAGES.numbers.to, "Numbers"],
];

/** A one-page answer to "where is that and how does this app work?" for anyone new. */
export const HelpPage = () => (
  <div className="mx-auto flex max-w-3xl flex-col gap-6">
    <div>
      <h2 className="text-2xl font-bold tracking-tight">
        How THE LAB app works
      </h2>
      <p className="text-sm text-muted-foreground">
        One job from first message to review, and where to find everything on
        the way.
      </p>
    </div>

    <section aria-labelledby="help-life" className="flex flex-col gap-2">
      <h3 id="help-life" className="text-base font-semibold normal-case">
        The life of a job
      </h3>
      <ol className="flex flex-col gap-2">
        {STEPS.map(([title, text], i) => (
          <li key={title}>
            <Card className="flex-row items-start gap-3 p-3">
              <span className="lab-num grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </section>

    <section aria-labelledby="help-find" className="flex flex-col gap-2">
      <h3 id="help-find" className="text-base font-semibold normal-case">
        Where do I find...
      </h3>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {FIND.map(([question, to, label]) => (
          <li
            key={to}
            className="flex items-baseline justify-between gap-3 p-3 text-sm"
          >
            <span>{question}</span>
            <Link
              to={to}
              className="shrink-0 font-medium underline-offset-2 hover:underline"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>

    <section aria-labelledby="help-rules" className="flex flex-col gap-2">
      <h3 id="help-rules" className="text-base font-semibold normal-case">
        Good to know
      </h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
        <li>
          Nothing is texted for you. Every text opens your Messages app (or
          copies on a computer) so you send it yourself.
        </li>
        <li>
          Review texts wait for the evening, 5 to 9 p.m. Use Remind me this
          evening to put it in Tasks for 6 p.m.
        </li>
        <li>
          Prices and stock come from Shopify. Change them there, then press Sync
          catalog.
        </li>
        <li>
          Shop floor controls hide on a job until the truck is booked in for
          today.
        </li>
      </ul>
    </section>
  </div>
);
