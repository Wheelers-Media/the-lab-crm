import type { Deal } from "../types";
import { linesTotal } from "./packageModel";

const money = (n: number) =>
  n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  });

const SOURCE = {
  quote: "the instant quote tool",
  walkthrough: "a service page walkthrough",
  form: "the request form",
};

/** Packages on the job and, when it came from the website, what was quoted. */
export const DealPackagesShow = ({ deal }: { deal: Deal }) => {
  const lines = deal.packages ?? [];
  const quote = deal.quote;
  if (!lines.length && !quote) return null;
  return (
    <div className="m-4 flex flex-col gap-4">
      {lines.length ? (
        <div>
          <span className="text-xs text-muted-foreground tracking-wide">
            Packages
          </span>
          <ul className="mt-1 divide-y divide-border rounded-md border border-border">
            {lines.map((line, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm"
              >
                <span>
                  {line.quantity > 1 ? `${line.quantity} × ` : ""}
                  {line.title}
                </span>
                <span className="lab-num">
                  {money(line.price * (line.quantity || 1))}
                </span>
              </li>
            ))}
            <li className="flex justify-between px-3 py-2 text-sm font-semibold">
              <span>Total</span>
              <span className="lab-num">{money(linesTotal(lines))}</span>
            </li>
          </ul>
        </div>
      ) : null}
      {quote ? (
        <div>
          <span className="text-xs text-muted-foreground tracking-wide">
            Website quote
            {quote.total ? `: ${quote.total} starting price` : ""}
            {quote.source
              ? `, from ${SOURCE[quote.source] ?? quote.source}`
              : ""}
          </span>
          {quote.choices?.length ? (
            <dl className="mt-1 grid grid-cols-[minmax(0,10rem)_1fr] gap-x-3 gap-y-1 text-sm">
              {quote.choices.map((c, i) => (
                <div key={i} className="contents">
                  <dt className="text-muted-foreground">{c.label}</dt>
                  <dd>{c.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {quote.summary ? (
            <p className="mt-2 text-sm whitespace-pre-line">{quote.summary}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
