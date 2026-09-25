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
