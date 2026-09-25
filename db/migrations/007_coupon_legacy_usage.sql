ALTER TABLE coupons ADD COLUMN IF NOT EXISTS legacy_usage_count integer NOT NULL DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS legacy_used_by text[] NOT NULL DEFAULT '{}';
