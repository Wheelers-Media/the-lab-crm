import { ExternalLink } from "lucide-react";
import {
  RecordContextProvider,
  ShowBase,
  useGetList,
  useShowContext,
} from "ra-core";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { ContactLink } from "../shop/ContactLink";
import { formatMoney } from "../shop/shopFormat";
import type { Package } from "../types";
import { packagePriceLabel } from "./packageModel";
import { KindChip, ProductThumb, StockChip, stockLabel } from "./ProductList";

const SHOPIFY_ADMIN = "https://admin.shopify.com/store/xr6pmx-y0";
const IS_DEMO = import.meta.env.VITE_IS_DEMO === "true";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

type OrderLine = {
  id: string;
  order_id: number;
  order_number: string;
  contact_id: number | null;
  ordered_at: string;
  cancelled_at: string | null;
  name: string;
  quantity: number;
  price: number;
};

/** Order lines naming this product (any option), newest first. */
const useBuyers = (pkg: Package) => {
  // Every word of the short title; the line name may add the option
  const words = pkg.title
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
    .join(" ");
  const { data = [] } = useGetList<OrderLine>(
    "order_lines",
    {
      filter: { "name@ilike": words, "cancelled_at@is": null },
      sort: { field: "ordered_at", order: "DESC" },
      pagination: { page: 1, perPage: 50 },
    },
    // The demo's in-browser data has no order_lines view
    { enabled: !IS_DEMO && Boolean(words) },
  );
  return data;
};

const Buyers = ({ pkg }: { pkg: Package }) => {
  const lines = useBuyers(pkg);
  if (IS_DEMO) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg">Customers who bought it</h2>
      {lines.length ? (
        <ul className="divide-y divide-border">
          {lines.map((line) => (
            <RecordContextProvider key={line.id} value={line}>
              <li className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">
                    <ContactLink fallback="In-shop sale, no customer" />
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {line.quantity > 1 ? `${line.quantity} × ` : ""}
                    {line.name}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0 text-right">
                  {shortDate(line.ordered_at)} · {line.order_number}
                  <span className="block lab-num">
                    {formatMoney(line.price * line.quantity)}
                  </span>
                </span>
              </li>
            </RecordContextProvider>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No Shopify orders with this item yet.
        </p>
      )}
    </section>
  );
};

const ProductDetail = () => {
  const { record: pkg, isPending } = useShowContext<Package>();
  const { dealCategories } = useConfigurationContext();
  if (isPending || !pkg) return null;
  const category =
    dealCategories.find((c) => c.value === pkg.category)?.label ?? "Other";
  const hasOptions =
    pkg.variants.length > 1 ||
    (pkg.variants[0] && pkg.variants[0].title !== "Default Title");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-4">
        <ProductThumb pkg={pkg} size={96} />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <h1 className="text-2xl break-words">{pkg.title}</h1>
          <div className="flex flex-wrap items-center gap-1">
            <KindChip pkg={pkg} />
            <span className="lab-chip lab-chip-muted">{category}</span>
            <StockChip inventory={pkg.inventory} />
            {pkg.status !== "active" ? (
              <span className="lab-chip lab-chip-muted">{pkg.status}</span>
            ) : null}
          </div>
          <p className="text-xl lab-num">{packagePriceLabel(pkg)}</p>
          <p className="text-xs text-muted-foreground">
            {[pkg.vendor, pkg.product_type].filter(Boolean).join(" · ")}
            {pkg.vendor || pkg.product_type ? " · " : ""}
            Synced from Shopify {shortDate(pkg.synced_at)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a
            href={`${SHOPIFY_ADMIN}/products/${pkg.shopify_product_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="size-3.5" />
            Edit in Shopify
          </a>
        </Button>
      </div>

      {hasOptions ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg">Options</h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {pkg.variants.map((v) => (
              <li
                key={v.id}
                className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  {v.title}
                  {v.sku ? (
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · {v.sku}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-baseline gap-3 shrink-0">
                  {stockLabel(v.inventory ?? null) ? (
                    <span className="text-xs text-muted-foreground">
                      {stockLabel(v.inventory ?? null)}
                    </span>
                  ) : null}
                  <span className="lab-num">{formatMoney(v.price)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Buyers pkg={pkg} />

      <p className="text-xs text-muted-foreground">
        Names, prices and stock come from Shopify. Change them there and the CRM
        updates on its own.
      </p>
    </div>
  );
};

export const ProductShow = () => {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <ShowBase resource="packages">
        <MobileHeader>
          <Link to="/packages" className="text-sm underline">
            All packages
          </Link>
        </MobileHeader>
        <MobileContent>
          <ProductDetail />
        </MobileContent>
      </ShowBase>
    );
  }
  return (
    <ShowBase resource="packages">
      <div className="mt-2 max-w-4xl">
        <Card>
          <CardContent>
            <ProductDetail />
          </CardContent>
        </Card>
      </div>
    </ShowBase>
  );
};
