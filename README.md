# Simple Kitchen

Modern, Docker-ready replacement for the Simple Kitchen Prep WordPress/WooCommerce storefront.

The build preserves the existing Simple Kitchen visual identity and weekly ordering model while moving the storefront into a maintainable Next.js application.

## Implemented

- Responsive Simple Kitchen storefront
- Six-week rotating menu engine
- Saturday 12 noon → Wednesday 11:59pm order window (Europe/London)
- Gift cards remain visible while the meal menu is closed
- Current public menu seeded from the live site (23 September 2026)
- Legacy six-week catalogue retained as migration seed data
- Basket and checkout flow
- Delivery / collection
- Weekly capacity controls
- Shared delivery capacity
- Stripe checkout + webhook support
- Weekly subscription checkout
- Christmas Giving round-up and Simple Kitchen match tracking
- PostgreSQL order persistence
- Docker / Plesk deployment
- WooCommerce product importer for final catalogue/media migration

See `.env.example` for deployment settings.
