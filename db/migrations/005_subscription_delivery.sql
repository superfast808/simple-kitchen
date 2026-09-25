ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_address jsonb;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_zone text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_fee_pence integer NOT NULL DEFAULT 0;
