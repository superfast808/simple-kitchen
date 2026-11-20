# Simple Kitchen

Modern, Docker-ready replacement for the Simple Kitchen Prep WordPress/WooCommerce storefront.

The application preserves the current Simple Kitchen ordering model while moving commerce, subscriptions, fulfilment, messaging and management into a maintainable Next.js + PostgreSQL stack.

## Implemented

- Responsive six-week storefront and basket
- Stripe checkout and webhook handling
- Postcode-controlled delivery and collection
- Zone-specific fees and minimum order values
- Weekly item and delivery-slot capacity protection
- Weekly, fortnightly and special twice-weekly subscriptions
- Runtime subscription plan pricing and visibility
- Subscription delivery validation and persisted address/zone data
- Personal meal-selection links and reminder email
- ClickSend weekly SMS reminders with audience exclusions and preview
- Christmas Giving round-up and Simple Kitchen matching
- PostgreSQL order/subscription persistence
- Docker / Plesk deployment on localhost port 8092
- WooCommerce product and migration importers

## Operations Console

The responsive /admin console provides:

- Dashboard KPIs and action centre
- Order search, detail and status management
- Subscriber management and real Stripe cancellation
- Subscription plan pricing, copy and visibility management
- Menu/product price, copy, image, week and availability overrides
- Delivery/collection toggles, zones, postcode prefixes, fees, minimums and capacities
- SMS/SMTP configuration, preview, manual send and test email
- Stripe key and webhook-secret management
- Six-week cycle and emergency ordering controls
- Christmas Giving controls
- Multiple admin users and roles
- Revocable database-backed sessions and login throttling
- Encrypted secret storage
- System health checks and privileged audit trail

See .env.example for deployment and admin-bootstrap settings.

## Kitchen system connection (simplekitchen-admin)

simplekitchen-admin was built against WooCommerce. This site serves the same
WooCommerce REST API (`/wp-json/wc/v3/...`) and webhooks, so admin needs **no
code changes** — only its connection settings.

What admin uses, and what this site provides:

| admin does | served by |
|---|---|
| Polls orders (`GET orders?status=…&after=…`) | Woo-shaped orders, numbered above every imported Woo order |
| Imports products, weeks and subscription variations | `GET products`, `products/{id}/variations` with `Week 1`–`Week 6` categories |
| Refund + cancel (`POST orders/{id}/refunds`, `PUT orders/{id}`) | Stripe refund, then status change |
| Tests the connection (`GET system_status`) | Basic environment info |
| Receives `order.created` / `order.updated` webhooks | Signed with `X-WC-Webhook-Signature` exactly like Woo |

Subscriptions: this site takes the payment. Every paid period becomes an order
with a `Weekly Meal Subscription - 10` style line, as WooCommerce Subscriptions
produced, and admin sends the weekly meal-choice email from there. Renewals are
anchored to the menu opening (Saturday 12 noon by default) so each lands in
admin's Saturday–Wednesday week. The site's own meal selector stays switched
off unless `SUBSCRIPTION_MEAL_SELECTION=site`.

### Cutover checklist

1. Set `KITCHEN_API_KEY`, `KITCHEN_API_SECRET`, `KITCHEN_WEBHOOK_SECRET` (and the
   other `KITCHEN_*` values) in `.env`; restart.
2. Run the Woo history import (`npm run import:woo-history`) and the coupon
   import in /admin → Coupons, so history and live codes (including SK Rewards
   referral and January codes) are present. Imported orders keep their Woo number.
3. In admin → Settings → WooCommerce connection: store URL
   `https://simplekitchenprep.com`, key/secret from step 1, then **Test**.
4. In admin's environment set `WC_WEBHOOK_SECRET` to the same value as
   `KITCHEN_WEBHOOK_SECRET`.
5. In Stripe, send `checkout.session.completed`, `checkout.session.expired`,
   `invoice.paid` and `customer.subscription.deleted` to `/api/stripe/webhook`.

### SK Rewards carry-over

- January 2027 loyalty codes import with their rules: usable 1–31 January,
  25% of eligible food up to £20, single use, email-restricted.
- Refer-a-friend 10% codes import as normal coupons.
- `/order-here/ref/<token>` links (and the old `/order`) redirect to `/order-here`.
- Free gift £0 lines on imported orders are kept, with their gift metadata.
- /admin → Customers → **Customer of the Year CSV**.
