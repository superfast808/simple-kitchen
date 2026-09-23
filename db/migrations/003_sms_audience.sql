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
