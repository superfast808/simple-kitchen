ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id uuid;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_pence integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  woo_id bigint UNIQUE,
  code text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'fixed_cart' CHECK (discount_type IN ('percent','fixed_cart','fixed_product')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  expiry_at timestamptz,
  minimum_amount_pence integer NOT NULL DEFAULT 0,
  maximum_amount_pence integer,
  usage_limit integer,
  usage_limit_per_customer integer,
  limit_usage_to_x_items integer,
  individual_use boolean NOT NULL DEFAULT false,
  free_shipping boolean NOT NULL DEFAULT false,
  product_ids text[] NOT NULL DEFAULT '{}',
  excluded_product_ids text[] NOT NULL DEFAULT '{}',
  categories text[] NOT NULL DEFAULT '{}',
  excluded_categories text[] NOT NULL DEFAULT '{}',
  exclude_sale_items boolean NOT NULL DEFAULT false,
  allowed_emails text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_unique_idx ON coupons (lower(code));
CREATE INDEX IF NOT EXISTS coupons_enabled_idx ON coupons (enabled,expiry_at);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id bigserial PRIMARY KEY,
  coupon_id uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_email text,
  discount_pence integer NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coupon_id,order_id)
);
CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx ON coupon_redemptions (coupon_id,redeemed_at);
CREATE INDEX IF NOT EXISTS coupon_redemptions_email_idx ON coupon_redemptions (lower(customer_email));
