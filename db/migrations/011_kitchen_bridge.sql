-- Kitchen-system bridge (applied automatically at runtime by lib/kitchenBridge.ts;
-- kept here as a record of the schema change).
CREATE SEQUENCE IF NOT EXISTS order_number_seq;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number bigint;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_invoice_id text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_unique_idx ON orders (order_number) WHERE order_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_invoice_unique_idx ON orders (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS order_refunds (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount_pence integer NOT NULL CHECK (amount_pence>0),
  reason text,
  stripe_refund_id text UNIQUE,
  refunded_payment boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS bridge_product_id_seq START 900000;
CREATE TABLE IF NOT EXISTS bridge_product_ids (
  product_id text PRIMARY KEY,
  numeric_id bigint NOT NULL UNIQUE DEFAULT nextval('bridge_product_id_seq'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS percent_cap numeric(5,2);
