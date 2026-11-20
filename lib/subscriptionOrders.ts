// Turns each paid Stripe subscription invoice into an order, in the same shape
// WooCommerce Subscriptions produced (a "Weekly Meal Subscription - 10" line).
// simplekitchen-admin spots those orders and runs the weekly meal choices.

import type Stripe from "stripe";
import { DateTime } from "luxon";
import { getRuntimeMenuState } from "./cycle";
import { db,transaction } from "./db";
import { ensureBridgeSchema } from "./kitchenBridge";
import { getRuntimeSubscriptionPlan } from "./runtimeSubscriptions";
import { getStripe } from "./stripe";

type SubscriptionMeta=Record<string,string>;

function invoiceSubscriptionId(invoice:Stripe.Invoice){
  const anyInvoice=invoice as any;
  const value=anyInvoice.parent?.subscription_details?.subscription??anyInvoice.subscription;
  return typeof value==="string"?value:value?.id||"";
}

function invoiceSubscriptionMeta(invoice:Stripe.Invoice):SubscriptionMeta{
  const anyInvoice=invoice as any;
  return anyInvoice.parent?.subscription_details?.metadata||anyInvoice.subscription_details?.metadata||{};
}

/** Subscriptions started before this release only carry details in our own table. */
async function legacyMeta(subscriptionId:string):Promise<SubscriptionMeta>{
  const result=await db().query(
    `SELECT customer_name,customer_email,meals_per_week,fulfilment,cadence_weeks,source_plan,delivery_address,delivery_zone,delivery_fee_pence
     FROM subscriptions WHERE stripe_subscription_id=$1`,
    [subscriptionId]
  ).catch(()=>({rows:[]as any[]}));
  const row=result.rows[0];
  if(!row) return {};
  const address=row.delivery_address||{};
  return {
    type:"subscription",plan:String(row.source_plan||"weekly"),meals:String(row.meals_per_week),
    fulfilment:String(row.fulfilment),customerName:String(row.customer_name||""),
    address1:String(address.address1||""),address2:String(address.address2||""),city:String(address.city||""),
    postcode:String(address.postcode||""),deliveryZone:String(row.delivery_zone||""),
    deliveryFeePence:String(row.delivery_fee_pence||0)
  };
}

async function resolveMeta(invoice:Stripe.Invoice,subscriptionId:string){
  let meta=invoiceSubscriptionMeta(invoice);
  if(meta.type!=="subscription"&&subscriptionId){
    try{
      const stripe=await getStripe();
      const subscription=await stripe.subscriptions.retrieve(subscriptionId);
      if(subscription.metadata?.type==="subscription") meta=subscription.metadata;
    }catch{/* fall through to the local record */}
  }
  if(meta.type!=="subscription"&&subscriptionId) meta=await legacyMeta(subscriptionId);
  return meta.type==="subscription"?meta:null;
}

/**
 * Records a paid subscription invoice as an order. Idempotent per invoice.
 * Returns the new order id, or null if nothing was created (unpaid, £0 or a
 * repeat delivery of the same Stripe event).
 */
export async function recordSubscriptionInvoice(invoice:Stripe.Invoice){
  await ensureBridgeSchema();
  const amountPaid=Number(invoice.amount_paid||0);
  if(amountPaid<=0||!invoice.id) return null;
  const subscriptionId=invoiceSubscriptionId(invoice);
  if(!subscriptionId) return null;
  const meta=await resolveMeta(invoice,subscriptionId);
  if(!meta) return null;

  const plan=await getRuntimeSubscriptionPlan(meta.plan||"weekly");
  const meals=Math.max(1,Number(meta.meals)||0);
  const option=plan.options.find((item)=>item.meals===meals);
  const deliveryFeePence=meta.fulfilment==="delivery"?Math.min(amountPaid,Math.max(0,Number(meta.deliveryFeePence)||0)):0;
  const mealsPence=Math.max(0,amountPaid-deliveryFeePence);
  const renewal=String(invoice.billing_reason||"")==="subscription_cycle";
  const state=await getRuntimeMenuState();
  const fulfilment=meta.fulfilment==="delivery"?"delivery":"collection";
  const email=String(invoice.customer_email||"");
  const customer={
    name:String(meta.customerName||invoice.customer_name||""),
    email,
    phone:String(meta.phone||invoice.customer_phone||""),
    address1:String(meta.address1||""),
    address2:String(meta.address2||""),
    city:String(meta.city||""),
    postcode:String(meta.postcode||"")
  };
  const paidAt=invoice.status_transitions?.paid_at?new Date(invoice.status_transitions.paid_at*1000):new Date();

  return transaction(async(client)=>{
    const inserted=await client.query(
      `INSERT INTO orders
        (created_at,cycle_key,fulfilment_date,status,fulfilment,subtotal_pence,shipping_pence,donation_pence,matched_donation_pence,
         discount_pence,total_pence,customer,source,stripe_invoice_id,date_paid,payment_method,payment_method_title,source_meta)
       VALUES ($1,$2,$3,'paid',$4,$5,$6,0,0,0,$7,$8::jsonb,'stripe_subscription',$9,$1,'stripe','Credit / Debit Card',$10::jsonb)
       ON CONFLICT (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        paidAt,state.windowStart.slice(0,10),state.fulfilmentDate,fulfilment,mealsPence,deliveryFeePence,amountPaid,
        JSON.stringify(customer),invoice.id,
        JSON.stringify({
          created_via:renewal?"subscription":"checkout",
          subscription_id:subscriptionId,
          billing_reason:invoice.billing_reason||null,
          plan:plan.id,
          meals,
          delivery_zone:meta.deliveryZone||null
        })
      ]
    );
    const orderId=inserted.rows[0]?.id?String(inserted.rows[0].id):null;
    if(!orderId) return null;
    await client.query(
      `INSERT INTO order_items (order_id,product_id,name,unit_price_pence,quantity,woo_variation_id,subtotal_pence,total_pence,source_meta)
       VALUES ($1,$2,$3,$4,1,$5,$4,$4,$6::jsonb)`,
      [
        orderId,String(plan.wooProductId),plan.name+" - "+meals,mealsPence,option?.wooVariationId||null,
        JSON.stringify({meta_data:[{id:1,key:"meals",value:String(meals)},{id:2,key:"_sk_menu_week",value:String(state.week)}]})
      ]
    );
    return orderId;
  });
}

/**
 * Renewals are anchored to the menu opening (Saturday 12 noon by default) so
 * every renewal order lands inside the kitchen system's Saturday–Wednesday
 * ordering week, which is when it sends the "choose your meals" email.
 *
 * - Menu open now: charge the first period today, renew one interval after
 *   this week's opening.
 * - Menu closed: nothing today; first charge when the next menu opens.
 */
export async function subscriptionBillingPlan(intervalWeeks:number){
  const state=await getRuntimeMenuState();
  const payNow=state.open;
  let anchor=DateTime.fromISO(state.windowStart).plus(payNow?{weeks:intervalWeeks}:{});
  const earliest=DateTime.now().plus({hours:1});
  while(anchor<earliest) anchor=anchor.plus({weeks:intervalWeeks});
  return {payNow,anchor,firstChargeLabel:anchor.setZone("Europe/London").toFormat("cccc d LLLL 'at' h:mm a")};
}
