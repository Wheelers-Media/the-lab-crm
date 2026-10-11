import { useSearchParams } from "react-router";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";

import { CustomersSection } from "./CustomersSection";
import { type NumbersPeriod, NUMBERS_PERIODS } from "./periods";
import { PipelineSection } from "./PipelineSection";
import { ProductsSection } from "./ProductsSection";
import { SalesSection } from "./SalesSection";
import { ShopSection } from "./ShopSection";
import { useNumbersData } from "./useNumbersData";

const isPeriod = (value: string | null): value is NumbersPeriod =>
  NUMBERS_PERIODS.some((p) => p.value === value);

const Heading = ({ children }: { children: string }) => (
  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mt-4">
    {children}
  </h2>
);

/** The shop's numbers: sales, products, customers, leads, stock and capacity. */
export const NumbersPage = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get("period");
  const period: NumbersPeriod = isPeriod(requested) ? requested : "month";
  const data = useNumbersData(period);
  const label = NUMBERS_PERIODS.find((p) => p.value === period)!;

  return (
    <div className="flex flex-col gap-4 mt-2 max-w-screen-2xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display uppercase tracking-wide">
            Numbers
          </h1>
          <p className="text-sm text-muted-foreground">
            {label.label}, {label.vs}. From Shopify orders and the CRM.
          </p>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={period}
          onValueChange={(v) => {
            if (!v) return;
            const next = new URLSearchParams(params);
            next.set("period", v);
            setParams(next, { replace: true });
          }}
          aria-label="Period"
          className="flex-wrap"
        >
          {NUMBERS_PERIODS.map((p) => (
            <ToggleGroupItem
              key={p.value}
              value={p.value}
              className="px-3 min-h-9"
            >
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {data.error ? (
        <p className="text-sm text-destructive">
          Could not load the orders. Try refreshing.
        </p>
      ) : data.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <>
          <Heading>Sales</Heading>
          <SalesSection
            orders={data.orders}
            ranges={data.ranges}
            vs={label.vs}
          />
          <Heading>Products</Heading>
          <ProductsSection
            orders={data.orders}
            catalog={data.catalog}
            ranges={data.ranges}
          />
          <Heading>Customers</Heading>
          <CustomersSection
            orders={data.ledgerOrders}
            ranges={data.ranges}
            now={data.now}
          />
          <Heading>Leads and carts</Heading>
          <PipelineSection
            deals={data.deals}
            changes={data.changes}
            checkouts={data.checkouts}
            ranges={data.ranges}
            now={data.now}
          />
          <Heading>Stock and shop capacity</Heading>
          <ShopSection
            catalog={data.catalog}
            orders={data.orders}
            appointments={data.appointments}
            ranges={data.ranges}
            now={data.now}
          />
        </>
      )}
    </div>
  );
};

NumbersPage.path = "/numbers";
