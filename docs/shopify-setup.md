# Connecting Shopify to THE LAB CRM

What this turns on:

- **Orders**: every paid order lands on the customer's contact (purchases and lifetime spend in the sidebar) and in the Orders tab.
- **$50 deposit**: a paid deposit moves the customer's open deal to Converted and marks their booked appointment as paid.
- **Abandoned carts**: carts are stored in the Abandoned carts tab. Any cart of $2,000 or more left unpaid for an hour gets a "Call" task for Eric.

Do the steps in order. Steps 1 to 3 take about ten minutes.

## 1. Put the latest code on the live CRM

From the repo, signed in to Supabase (`npx supabase login`) and linked to the live project (`npx supabase link`):

```bash
npx supabase db push                               # adds the orders, carts and appointments tables
npx supabase functions deploy shopify_webhook      # the receiver
```

The receiver's address is:

```
https://<project-ref>.supabase.co/functions/v1/shopify_webhook
```

`<project-ref>` is in the Supabase dashboard URL (`supabase.com/dashboard/project/<project-ref>`).

## 2. Tell Shopify to send orders and carts

Shopify admin → **Settings** → **Notifications** → **Webhooks** (at the bottom) → **Create webhook**. Make three, all with format **JSON**, the URL from step 1, and the newest API version:

| Event | Why |
|---|---|
| Order payment | Paid orders and deposits |
| Checkout creation | Starts tracking a cart |
| Checkout update | Keeps the cart total and contact current |

## 3. Give the CRM the signing secret

On the same Webhooks page, Shopify shows "Your webhooks will be signed with" followed by a long code. Copy it, then:

```bash
npx supabase secrets set SHOPIFY_WEBHOOK_SECRET=<that code>
```

Without this the receiver turns every message away, which is what keeps strangers from posting fake orders.

**Check it works:** click **Send test notification** next to "Order payment". In Supabase → Table editor → `integration_events`, a new `shopify` row should show `processed`. The test order is Shopify's sample customer, so it adds a contact named after them: delete that contact in the CRM afterwards.

## 4. Load past orders (one time)

The webhooks only catch orders from now on. To bring in the store's history:

1. Shopify admin → **Orders** → **Export** → **All orders** → **Plain CSV file**. Shopify emails or downloads `orders_export.csv`.
2. Check what will be imported (nothing is sent):

   ```bash
   node scripts/shopify-backfill.ts orders_export.csv
   ```

3. Import:

   ```bash
   SHOPIFY_WEBHOOK_SECRET=<the code from step 3> \
   CRM_FUNCTIONS_URL=https://<project-ref>.supabase.co/functions/v1 \
   node scripts/shopify-backfill.ts orders_export.csv --send
   ```

Past orders are added to each customer with their real dates. Nothing else happens: no deals move, no tasks are created, old deposits are only recorded. Only paid (or later refunded) orders are imported. Running it again skips orders already imported, so it is safe to re-run after a failure.

The CSV holds customer names, emails and phone numbers. Delete it when you're done; git already ignores it.

## Matching customers

A Shopify customer is matched to an existing contact by email, then phone. If neither matches, a new contact is created and tagged "Shopify customer" plus what they bought ("Tint", "Detailing", "Diesel parts"...). Existing contacts only gain details; nothing already on them is overwritten.
