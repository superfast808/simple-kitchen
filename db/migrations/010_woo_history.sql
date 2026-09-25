ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfilment_check;
ALTER TABLE orders ADD CONSTRAINT orders_fulfilment_check CHECK (fulfilment IN ('collection','delivery','electronic'));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'native';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS woo_order_id bigint;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS woo_parent_order_id bigint;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS woo_customer_id bigint;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS woo_order_number text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS woo_order_key text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method_title text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS date_paid timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS date_completed timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_meta jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS orders_woo_order_unique_idx ON orders (woo_order_id) WHERE woo_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_source_idx ON orders (source,created_at DESC);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS woo_line_item_id bigint;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS woo_variation_id bigint;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS subtotal_pence integer;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_pence integer;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS source_meta jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS order_items_woo_line_unique_idx ON order_items (order_id,woo_line_item_id) WHERE woo_line_item_id IS NOT NULL;

ALTER TABLE subscriptions ALTER COLUMN stripe_subscription_id DROP NOT NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'stripe';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS woo_subscription_id bigint;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS woo_parent_order_id bigint;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS woo_customer_id bigint;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method_title text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_period text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_interval integer;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_payment_at timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_payment_at timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS ended_at timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_address jsonb;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS shipping_address jsonb;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS source_meta jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_woo_unique_idx ON subscriptions (woo_subscription_id) WHERE woo_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscriptions_source_idx ON subscriptions (source,status);

CREATE TABLE IF NOT EXISTS subscription_history (
  id bigserial PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'woo',
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  message text,
  woo_note_id bigint,
  woo_order_id bigint,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscription_history_woo_note_unique_idx
  ON subscription_history (subscription_id,woo_note_id) WHERE woo_note_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscription_history_woo_order_unique_idx
  ON subscription_history (subscription_id,woo_order_id,event_type) WHERE woo_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS woo_customers (
  woo_customer_id bigint PRIMARY KEY,
  email text,
  first_name text,
  last_name text,
  username text,
  phone text,
  billing jsonb,
  shipping jsonb,
  date_created timestamptz,
  date_modified timestamptz,
  source_meta jsonb,
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS woo_customers_email_idx ON woo_customers (lower(email));
