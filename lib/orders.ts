import { getRuntimeCommerceSettings } from "./runtimeConfig";
import { db, transaction } from "./db";
import type { Fulfilment, Product } from "./types";

export class CapacityError extends Error {}

type ReservedItem = { product: Product; quantity: number };

type ReserveInput = {
  cycleKey: string;
  fulfilmentDate: string;
  fulfilment: Fulfilment;
  items: ReservedItem[];
  subtotalPence: number;
  shippingPence: number;
  donationPence: number;
  discountPence: number;
  couponId?: string | null;
  couponCode?: string | null;
  customer: Record<string, string>;
};

const ACTIVE_SQL = `(
  o.status IN ('paid','processing','completed','on_hold')
  OR (o.status = 'pending' AND (o.expires_at IS NULL OR o.expires_at > now()))
)`;

export async function reserveOrder(input: ReserveInput) {
  const runtime=await getRuntimeCommerceSettings();
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [input.cycleKey]);

    const itemCount = input.items.reduce((sum, item) => sum + item.quantity, 0);
    const used = await client.query(
      `SELECT COALESCE(SUM(oi.quantity),0)::int AS used
       FROM orders o JOIN order_items oi ON oi.order_id=o.id
       WHERE o.cycle_key=$1 AND ${ACTIVE_SQL}`,
      [input.cycleKey]
    );
    if (Number(used.rows[0].used) + itemCount > runtime.weeklyItemCap) {
      throw new CapacityError("We have SOLD OUT for this week. Please keep an eye on @simplekitchenprep for the next menu.");
    }

    if (input.fulfilment === "delivery") {
      const deliveries = await client.query(
        `SELECT COUNT(*)::int AS used FROM orders o
         WHERE o.fulfilment_date=$1 AND o.fulfilment='delivery' AND ${ACTIVE_SQL}`,
        [input.fulfilmentDate]
      );
      if (Number(deliveries.rows[0].used) >= runtime.deliverySlotCap) {
        throw new CapacityError("Delivery slots are full for this week. Collection is still available.");
      }
    }

    const totalPence = Math.max(0,input.subtotalPence + input.shippingPence + input.donationPence - input.discountPence);
    const order = await client.query(
      `INSERT INTO orders
       (cycle_key, fulfilment_date, fulfilment, subtotal_pence, shipping_pence, donation_pence, matched_donation_pence, discount_pence, coupon_id, coupon_code, total_pence, customer, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11::jsonb,now()+interval '30 minutes')
       RETURNING id`,
      [
        input.cycleKey,input.fulfilmentDate,input.fulfilment,input.subtotalPence,input.shippingPence,input.donationPence,
        input.discountPence,input.couponId||null,input.couponCode||null,totalPence,JSON.stringify(input.customer)
      ]
    );

    for (const item of input.items) {
      await client.query(
        "INSERT INTO order_items (order_id, product_id, name, unit_price_pence, quantity) VALUES ($1,$2,$3,$4,$5)",
        [order.rows[0].id, item.product.id, item.product.name, Math.round(item.product.price * 100), item.quantity]
      );
    }
    return String(order.rows[0].id);
  });
}

export async function attachStripeSession(orderId: string, sessionId: string) {
  await db().query("UPDATE orders SET stripe_session_id=$2, updated_at=now() WHERE id=$1", [orderId, sessionId]);
}
export async function markOrderStatus(orderId: string, status: string) {
  await db().query("UPDATE orders SET status=$2, updated_at=now() WHERE id=$1", [orderId, status]);
}
export async function markOrderStatusBySession(sessionId: string, status: string) {
  await db().query("UPDATE orders SET status=$2, updated_at=now() WHERE stripe_session_id=$1", [sessionId, status]);
}

export async function getCapacity(cycleKey: string, fulfilmentDate: string) {
  const runtime=await getRuntimeCommerceSettings();
  const item = await db().query(
    `SELECT COALESCE(SUM(oi.quantity),0)::int AS used FROM orders o JOIN order_items oi ON oi.order_id=o.id
     WHERE o.cycle_key=$1 AND ${ACTIVE_SQL}`,
    [cycleKey]
  );
  const delivery = await db().query(
    `SELECT COUNT(*)::int AS used FROM orders o
     WHERE o.fulfilment_date=$1 AND o.fulfilment='delivery' AND ${ACTIVE_SQL}`,
    [fulfilmentDate]
  );
  return {
    weeklyRemaining: Math.max(0, runtime.weeklyItemCap - Number(item.rows[0].used)),
    deliveryRemaining: Math.max(0, runtime.deliverySlotCap - Number(delivery.rows[0].used))
  };
}
