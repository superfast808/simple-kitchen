ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cadence_weeks integer NOT NULL DEFAULT 1;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS source_plan text NOT NULL DEFAULT 'weekly';
