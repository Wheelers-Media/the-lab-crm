import { ExternalLink, Globe } from "lucide-react";
import { ShowBase, useShowContext } from "ra-core";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { formatMoney } from "../shop/shopFormat";
import type { Package } from "../types";
import { packagePriceLabel } from "./packageModel";
import { marginOf, splitTags, websiteUrl } from "./productModel";
import { ProductGallery } from "./ProductGallery";
import { KindChip, StockChip, stockLabel } from "./ProductParts";
import { ProductSales } from "./ProductSales";

const SHOPIFY_ADMIN = "https://admin.shopify.com/store/xr6pmx-y0";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const kg = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} kg`;

const Options = ({ pkg }: { pkg: Package }) => {
  const hasOptions =
    pkg.variants.length > 1 ||
    (pkg.variants[0] && pkg.variants[0].title !== "Default Title");
  const hasCost = pkg.variants.some((v) => v.cost);
  const hasSale = pkg.variants.some((v) => v.compare_at);
  const hasWeight = pkg.variants.some((v) => v.weight_kg);
  if (!hasOptions && !hasCost && !hasWeight && !pkg.variants[0]?.sku)
    return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg">{hasOptions ? "Options" : "Details"}</h2>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              {hasOptions ? (
                <th className="px-3 py-2 font-medium">Option</th>
              ) : null}
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              {hasCost ? (
                <>
                  <th className="px-3 py-2 text-right font-medium">Cost</th>
                  <th className="px-3 py-2 text-right font-medium">Margin</th>
                </>
              ) : null}
              {hasWeight ? (
                <th className="px-3 py-2 text-right font-medium">Weight</th>
              ) : null}
              <th className="px-3 py-2 text-right font-medium">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pkg.variants.map((v) => {
              const margin = marginOf(v);
              return (
                <tr key={v.id}>
                  {hasOptions ? <td className="px-3 py-2">{v.title}</td> : null}
                  <td className="px-3 py-2 text-muted-foreground">
                    {v.sku ?? "–"}
                  </td>
                  <td className="lab-num whitespace-nowrap px-3 py-2 text-right">
                    {hasSale && v.compare_at ? (
                      <span className="mr-2 text-xs text-muted-foreground line-through">
                        {formatMoney(v.compare_at)}
                      </span>
                    ) : null}
                    {formatMoney(v.price)}
                  </td>
                  {hasCost ? (
                    <>
                      <td className="lab-num px-3 py-2 text-right">
                        {v.cost ? formatMoney(v.cost) : "–"}
                      </td>
                      <td className="lab-num whitespace-nowrap px-3 py-2 text-right">
                        {margin
                          ? `${formatMoney(margin.profit)} · ${margin.percent}%`
                          : "–"}
                      </td>
                    </>
                  ) : null}
                  {hasWeight ? (
                    <td className="lab-num px-3 py-2 text-right">
                      {v.weight_kg ? kg(v.weight_kg) : "–"}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                    {stockLabel(v.inventory ?? null) ?? "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const ProductDetail = () => {
  const { record: pkg, isPending } = useShowContext<Package>();
  const { dealCategories } = useConfigurationContext();
  if (isPending || !pkg) return null;
  const category =
    dealCategories.find((c) => c.value === pkg.category)?.label ?? "Other";
  const { shipping, others } = splitTags(pkg.tags);
  const site = websiteUrl(pkg);
  const hasPictures = Boolean(pkg.images?.length || pkg.image_url);
  return (
    <div className="flex flex-col gap-8">
      <div
        className={
          hasPictures
            ? "grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
            : "grid grid-cols-1 gap-6"
        }
      >
        {hasPictures ? <ProductGallery pkg={pkg} /> : null}
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {[pkg.vendor, pkg.product_type].filter(Boolean).join(" · ") ||
              "THE LAB"}
          </p>
          <h1 className="break-words text-2xl">{pkg.title}</h1>
          <div className="flex flex-wrap items-center gap-1">
            <KindChip pkg={pkg} />
            <span className="lab-chip lab-chip-muted">{category}</span>
            <StockChip inventory={pkg.inventory} />
            {pkg.status !== "active" ? (
              <span className="lab-chip lab-chip-muted">{pkg.status}</span>
            ) : null}
          </div>
          <p className="lab-num text-2xl">{packagePriceLabel(pkg)}</p>
          {shipping ? (
            <p className="text-sm text-muted-foreground">
              Ships as <span className="text-foreground">{shipping}</span>
            </p>
          ) : null}
          {others.length ? (
            <div className="flex flex-wrap gap-1">
              {others.map((tag) => (
                <span key={tag} className="lab-chip lab-chip-muted">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {site ? (
              <Button asChild variant="outline" size="sm">
                <a href={site} target="_blank" rel="noopener noreferrer">
                  <Globe className="size-3.5" />
                  View on website
                </a>
              </Button>
            ) : null}
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
          <p className="text-xs text-muted-foreground">
            Names, prices and stock come from Shopify. Synced{" "}
            {shortDate(pkg.synced_at)}.
          </p>
        </div>
      </div>

      <Options pkg={pkg} />

      {pkg.description ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg">Description</h2>
          <p className="whitespace-pre-line text-sm leading-6">
            {pkg.description}
          </p>
        </section>
      ) : null}

      <ProductSales pkg={pkg} />
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
      <div className="mt-2 max-w-5xl">
        <Card>
          <CardContent>
            <ProductDetail />
          </CardContent>
        </Card>
      </div>
    </ShowBase>
  );
};
