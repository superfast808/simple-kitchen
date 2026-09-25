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
