CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cycle_key date NOT NULL,
  fulfilment_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  fulfilment text NOT NULL CHECK (fulfilment IN ('collection','delivery')),
  subtotal_pence integer NOT NULL,
  shipping_pence integer NOT NULL DEFAULT 0,
  donation_pence integer NOT NULL DEFAULT 0,
  matched_donation_pence integer NOT NULL DEFAULT 0,
  total_pence integer NOT NULL,
  customer jsonb NOT NULL,
  stripe_session_id text,
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS orders_cycle_status_idx ON orders (cycle_key,status);
CREATE INDEX IF NOT EXISTS orders_fulfilment_idx ON orders (fulfilment_date,fulfilment,status);
CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_idx ON orders (stripe_session_id) WHERE stripe_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_items (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  name text NOT NULL,
  unit_price_pence integer NOT NULL,
  quantity integer NOT NULL CHECK (quantity>0)
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  stripe_subscription_id text UNIQUE NOT NULL,
  stripe_customer_id text,
  customer_email text NOT NULL,
  customer_name text,
  meals_per_week integer NOT NULL,
  fulfilment text NOT NULL CHECK (fulfilment IN ('collection','delivery')),
  cadence_weeks integer NOT NULL DEFAULT 1,
  source_plan text NOT NULL DEFAULT 'weekly',
  selection_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE
);

CREATE TABLE IF NOT EXISTS subscription_selections (
  id bigserial PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  cycle_key date NOT NULL,
  selection jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id,cycle_key)
);
