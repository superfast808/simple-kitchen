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
