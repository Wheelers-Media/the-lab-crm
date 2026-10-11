// Copies the whole Shopify catalog into the CRM with what the product page
// shows: descriptions, pictures, tags, SKUs, sale prices, weights and, when the
// app is allowed to read it, the cost of each item. Signed-in CRM users only.
// The product webhook keeps products current afterwards; this fills in the
// ones that were copied before those details were kept.
//
// POST {} -> { synced, withCost, costAvailable }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { packageFromGraphql } from "../_shared/lab/packages.ts";
import {
  adminAccessToken,
  ShopifyFailure,
  shopDomain,
  shopifyGraphql,
} from "../_shared/lab/shopifyAdmin.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";

const PAGE_SIZE = 50;
const MAX_PAGES = 40;
const UPSERT_CHUNK = 100;

// Cost and weight live on the inventory item, which needs the read_inventory
// scope; the first attempt asks for them and falls back without
const productsQuery = (withInventoryItem: boolean) => `
query($cursor: String) {
  products(first: ${PAGE_SIZE}, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title handle vendor productType tags status updatedAt descriptionHtml tracksInventory
      featuredMedia { preview { image { url } } }
      media(first: 8) { nodes { ... on MediaImage { image { url altText } } } }
      variants(first: 50) {
        nodes {
          id title sku price compareAtPrice inventoryQuantity
          ${withInventoryItem ? "inventoryItem { tracked unitCost { amount } measurement { weight { value unit } } }" : ""}
        }
      }
    }
  }
}`;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const fetchProducts = async (
  shop: string,
  token: string,
  withInventoryItem: boolean,
): Promise<unknown[]> => {
  const products: unknown[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await shopifyGraphql(
      shop,
      token,
      productsQuery(withInventoryItem),
      { cursor },
      "read_products (and read_inventory for cost)",
    );
    products.push(...(data?.products?.nodes ?? []));
    if (!data?.products?.pageInfo?.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return products;
};

const handle = async () => {
  const rawShop = Deno.env.get("SHOPIFY_SHOP");
  const shop = rawShop ? shopDomain(rawShop) : null;
  const token = shop ? await adminAccessToken(shop) : null;
  if (!shop || !token) {
    return createErrorResponse(
      503,
      "The CRM is not connected to Shopify yet.",
      {
        code: "not_connected",
      },
    );
  }

  let costAvailable = true;
  let products: unknown[];
  try {
    products = await fetchProducts(shop, token, true);
  } catch (error) {
    if (!(error instanceof ShopifyFailure)) throw error;
    costAvailable = false;
    products = await fetchProducts(shop, token, false);
  }

  const syncedAt = new Date().toISOString();
  const rows = products
    .map(packageFromGraphql)
    .filter((row) => row != null)
    .map((row) => ({ ...row, synced_at: syncedAt }));
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error } = await supabaseAdmin
      .from("packages")
      .upsert(rows.slice(i, i + UPSERT_CHUNK), {
        onConflict: "shopify_product_id",
      });
    if (error) throw new Error(`save products: ${error.message}`);
  }

  return json({
    synced: rows.length,
    costAvailable,
    withCost: rows.filter((row) => row.variants.some((v) => v.cost != null))
      .length,
  });
};

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req) => {
        if (req.method !== "POST") {
          return createErrorResponse(405, "Method Not Allowed");
        }
        try {
          return await handle();
        } catch (error) {
          console.error("catalog_sync failed:", error);
          return createErrorResponse(
            500,
            error instanceof ShopifyFailure
              ? error.message
              : `Could not sync the catalog: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    ),
  ),
);
