CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cycle_key date NOT NULL,
  fulfilment_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  fulfilment text NOT NULL CHECK (fulfilment IN ('collection','delivery','electronic')),
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


CREATE TABLE IF NOT EXISTS sms_audience (
  id bigserial PRIMARY KEY,
  phone_normalized text UNIQUE NOT NULL,
  phone_raw text,
  email text,
  first_name text,
  last_name text,
  last_order_at timestamptz,
  active_subscription boolean NOT NULL DEFAULT false,
  last_reminder_week date,
  last_reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_audience_last_order_idx ON sms_audience (last_order_at);
CREATE INDEX IF NOT EXISTS sms_audience_email_idx ON sms_audience (lower(email));


CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  display_name text NOT NULL DEFAULT 'Administrator',
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','operator','viewer')),
  enabled boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  ip_address text,
  user_agent text,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_sessions_user_idx ON admin_sessions (user_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id bigserial PRIMARY KEY,
  email text,
  ip_address text,
  success boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_login_attempts_lookup_idx ON admin_login_attempts (email, ip_address, attempted_at);

CREATE TABLE IF NOT EXISTS admin_settings (
  key text PRIMARY KEY,
  value jsonb,
  encrypted_value text,
  is_secret boolean NOT NULL DEFAULT false,
  description text,
  updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  detail jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_entity_idx ON admin_audit_log (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS product_overrides (
  product_id text PRIMARY KEY,
  enabled boolean,
  name text,
  description text,
  price_pence integer CHECK (price_pence IS NULL OR price_pence >= 0),
  category text,
  week integer CHECK (week IS NULL OR week BETWEEN 1 AND 6),
  image text,
  updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_address jsonb;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_zone text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_fee_pence integer NOT NULL DEFAULT 0;


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
  legacy_usage_count integer NOT NULL DEFAULT 0,
  legacy_used_by text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_unique_idx ON coupons (lower(code));

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id bigserial PRIMARY KEY,
  coupon_id uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_email text,
  discount_pence integer NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coupon_id,order_id)
);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfilment_check;
ALTER TABLE orders ADD CONSTRAINT orders_fulfilment_check CHECK (fulfilment IN ('collection','delivery','electronic'));

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS legacy_usage_count integer NOT NULL DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS legacy_used_by text[] NOT NULL DEFAULT '{}';


CREATE TABLE IF NOT EXISTS gift_card_issuances (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id bigint NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  sequence_no integer NOT NULL,
  coupon_id uuid REFERENCES coupons(id) ON DELETE RESTRICT,
  recipient_email text,
  delivery_claimed_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_item_id,sequence_no)
);
CREATE INDEX IF NOT EXISTS gift_card_issuances_order_idx ON gift_card_issuances (order_id);


ALTER TABLE product_overrides ADD COLUMN IF NOT EXISTS long_description text;
ALTER TABLE product_overrides ADD COLUMN IF NOT EXISTS ingredients text;

CREATE TABLE IF NOT EXISTS product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  url_path text NOT NULL,
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'admin',
  original_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id,url_path)
);
CREATE INDEX IF NOT EXISTS product_media_product_idx ON product_media (product_id,sort_order);

CREATE TABLE IF NOT EXISTS customer_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  phone text,
  password_hash text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  email_verified boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_users_email_unique_idx ON customer_users (lower(email));

CREATE TABLE IF NOT EXISTS customer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES customer_users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  ip_address text,
  user_agent text,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_sessions_user_idx ON customer_sessions (user_id);
CREATE INDEX IF NOT EXISTS customer_sessions_expiry_idx ON customer_sessions (expires_at);

CREATE TABLE IF NOT EXISTS customer_login_attempts (
  id bigserial PRIMARY KEY,
  email text,
  ip_address text,
  success boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_login_attempts_lookup_idx ON customer_login_attempts (email,ip_address,attempted_at);
