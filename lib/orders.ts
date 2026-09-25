import { getRuntimeCommerceSettings } from "./runtimeConfig";
import { db, transaction } from "./db";
import type { Fulfilment, Product } from "./types";

export class CapacityError extends Error {}
export class CouponReservationError extends Error {}

let orderSchemaReady:Promise<void>|null=null;
async function ensureOrderSchema(){
  if(!orderSchemaReady){
    orderSchemaReady=db().query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id uuid;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code text;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_pence integer NOT NULL DEFAULT 0;
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfilment_check;
      ALTER TABLE orders ADD CONSTRAINT orders_fulfilment_check CHECK (fulfilment IN ('collection','delivery','electronic'));
    `).then(()=>undefined);
  }
  await orderSchemaReady;
}

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
  await ensureOrderSchema();
  const runtime=await getRuntimeCommerceSettings();
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [input.cycleKey]);

    if(input.couponId){
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",["coupon:"+input.couponId]);
      const couponResult=await client.query(
        "SELECT * FROM coupons WHERE id=$1 FOR UPDATE",
        [input.couponId]
      );
      const coupon=couponResult.rows[0];
      if(!coupon||!coupon.enabled) throw new CouponReservationError("This coupon is no longer available.");
      if(coupon.expiry_at&&new Date(coupon.expiry_at).getTime()<Date.now()) throw new CouponReservationError("This coupon has expired.");

      const pending=await client.query(
        `SELECT COUNT(*)::int AS uses,COALESCE(SUM(discount_pence),0)::int AS discount
         FROM orders
         WHERE coupon_id=$1 AND status='pending' AND (expires_at IS NULL OR expires_at>now())`,
        [input.couponId]
      );
      const redeemed=await client.query(
        "SELECT COUNT(*)::int AS uses FROM coupon_redemptions WHERE coupon_id=$1",
        [input.couponId]
      );

      if(coupon.usage_limit!=null){
        const totalUses=Number(coupon.legacy_usage_count||0)+Number(redeemed.rows[0]?.uses||0)+Number(pending.rows[0]?.uses||0);
        if(totalUses>=Number(coupon.usage_limit)) throw new CouponReservationError("This coupon has reached its usage limit.");
      }

      if(coupon.usage_limit_per_customer!=null&&input.customer.email){
        const email=String(input.customer.email).toLowerCase();
        const legacy=(coupon.legacy_used_by||[]).filter((value:string)=>String(value).toLowerCase()===email).length;
        const usedBy=await client.query(
          "SELECT COUNT(*)::int AS uses FROM coupon_redemptions WHERE coupon_id=$1 AND lower(customer_email)=lower($2)",
          [input.couponId,input.customer.email]
        );
        const pendingBy=await client.query(
          `SELECT COUNT(*)::int AS uses FROM orders
           WHERE coupon_id=$1 AND status='pending' AND (expires_at IS NULL OR expires_at>now())
             AND lower(customer->>'email')=lower($2)`,
          [input.couponId,input.customer.email]
        );
        if(legacy+Number(usedBy.rows[0]?.uses||0)+Number(pendingBy.rows[0]?.uses||0)>=Number(coupon.usage_limit_per_customer)){
          throw new CouponReservationError("You have already used this coupon the maximum number of times.");
        }
      }

      if(coupon.source==="gift_card"){
        const availablePence=Math.max(0,Math.round(Number(coupon.amount||0)*100)-Number(pending.rows[0]?.discount||0));
        if(input.discountPence>availablePence) throw new CouponReservationError("This gift card no longer has enough available balance.");
      }
    }

    const itemCount = input.items.filter((item)=>item.product.category!=="gift").reduce((sum, item) => sum + item.quantity, 0);
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
