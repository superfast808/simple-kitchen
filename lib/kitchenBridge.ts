// Bridge between this storefront and the simplekitchen-admin kitchen system.
//
// simplekitchen-admin was built against WooCommerce: it polls
// /wp-json/wc/v3/orders, reads products/variations, issues refunds and
// cancellations through the Woo REST API, and listens for signed Woo
// webhooks. This module gives the storefront the same contract so the
// kitchen system keeps working unchanged once WordPress is switched off.
// Point admin's "WooCommerce connection" at this site with the
// KITCHEN_API_KEY / KITCHEN_API_SECRET pair and it carries on as before.

import crypto from "node:crypto";
import { DateTime } from "luxon";
import { config } from "./config";
import { db } from "./db";

const ZONE="Europe/London";

let bridgeReady:Promise<void>|null=null;

export async function ensureBridgeSchema(){
  if(!bridgeReady){
    bridgeReady=(async()=>{
      await db().query(`
        CREATE SEQUENCE IF NOT EXISTS order_number_seq;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id uuid;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code text;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_pence integer NOT NULL DEFAULT 0;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'native';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS woo_order_id bigint;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS woo_parent_order_id bigint;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS woo_customer_id bigint;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS woo_order_number text;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS woo_order_key text;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method_title text;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS date_paid timestamptz;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS date_completed timestamptz;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address jsonb;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address jsonb;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_meta jsonb;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number bigint;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_invoice_id text;
        ALTER TABLE order_items ADD COLUMN IF NOT EXISTS woo_line_item_id bigint;
        ALTER TABLE order_items ADD COLUMN IF NOT EXISTS woo_variation_id bigint;
        ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku text;
        ALTER TABLE order_items ADD COLUMN IF NOT EXISTS subtotal_pence integer;
        ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_pence integer;
        ALTER TABLE order_items ADD COLUMN IF NOT EXISTS source_meta jsonb;
        CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_unique_idx ON orders (order_number) WHERE order_number IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_invoice_unique_idx ON orders (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
        CREATE TABLE IF NOT EXISTS order_refunds (
          id bigserial PRIMARY KEY,
          order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          amount_pence integer NOT NULL CHECK (amount_pence>0),
          reason text,
          stripe_refund_id text UNIQUE,
          refunded_payment boolean NOT NULL DEFAULT false,
          created_by text,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS order_refunds_order_idx ON order_refunds (order_id);
        CREATE SEQUENCE IF NOT EXISTS bridge_product_id_seq START 900000;
        CREATE TABLE IF NOT EXISTS bridge_product_ids (
          product_id text PRIMARY KEY,
          numeric_id bigint NOT NULL UNIQUE DEFAULT nextval('bridge_product_id_seq'),
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      // Imported WooCommerce orders keep their original number so the kitchen
      // system recognises the history it already holds.
      await db().query("UPDATE orders SET order_number=woo_order_id WHERE order_number IS NULL AND woo_order_id IS NOT NULL");
      // Orders paid before this release have no payment date; the kitchen
      // system treats an order without one as unpaid when totalling.
      await db().query("UPDATE orders SET date_paid=updated_at WHERE date_paid IS NULL AND source<>'woo' AND status IN ('paid','processing','completed','on_hold')");
      await bumpOrderNumberSequence();
      await db().query(`
        UPDATE orders o SET order_number=n.num
        FROM (SELECT id,nextval('order_number_seq') AS num FROM (SELECT id FROM orders WHERE order_number IS NULL ORDER BY created_at) pending) n
        WHERE o.id=n.id
      `);
      await db().query("ALTER TABLE orders ALTER COLUMN order_number SET DEFAULT nextval('order_number_seq')");
    })().catch((error)=>{bridgeReady=null;throw error;});
  }
  await bridgeReady;
}

/**
 * New orders are numbered above every WooCommerce order ID, so they never
 * collide with history the kitchen system already holds. ORDER_NUMBER_START
 * adds a deliberate gap (default 100000) in case Woo keeps taking orders
 * for a while before cutover.
 */
export async function bumpOrderNumberSequence(){
  const start=Math.max(1,Number.parseInt(process.env.ORDER_NUMBER_START||"100000",10)||100000);
  await db().query(`
    SELECT setval('order_number_seq',GREATEST(
      (SELECT CASE WHEN is_called THEN last_value ELSE last_value-1 END FROM order_number_seq),
      COALESCE((SELECT max(order_number) FROM orders),0),
      COALESCE((SELECT max(woo_order_id) FROM orders),0),
      $1::bigint-1,
      1
    ),true)
  `,[start]);
}

// ── Formatting helpers ──────────────────────────────────────────────────────

export const money=(pence:number|string|null|undefined)=>(Math.round(Number(pence)||0)/100).toFixed(2);
const penceFromMoney=(value:unknown)=>Math.round((Number(value)||0)*100);

/** Woo returns site-local time without an offset, plus a separate GMT field. */
export function wooDates(value:Date|string|null|undefined){
  if(!value) return {local:null as string|null,gmt:null as string|null};
  const date=DateTime.fromJSDate(value instanceof Date?value:new Date(value));
  if(!date.isValid) return {local:null,gmt:null};
  return {
    local:date.setZone(ZONE).toFormat("yyyy-LL-dd'T'HH:mm:ss"),
    gmt:date.toUTC().toFormat("yyyy-LL-dd'T'HH:mm:ss")
  };
}

/** Parses Woo-style date filters: an explicit offset/Z, or site-local time. */
export function parseWooDate(value:string|null){
  if(!value) return null;
  const hasZone=/(Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
  const parsed=hasZone?DateTime.fromISO(value.trim()):DateTime.fromISO(value.trim(),{zone:ZONE});
  return parsed.isValid?parsed.toJSDate():null;
}

function splitName(name:string){
  const parts=String(name||"").trim().split(/\s+/).filter(Boolean);
  if(parts.length<=1) return {first:parts[0]||"",last:""};
  return {first:parts.slice(0,-1).join(" "),last:parts[parts.length-1]};
}

// ── Status mapping ──────────────────────────────────────────────────────────

const LOCAL_TO_WOO:Record<string,string>={
  paid:"processing",processing:"processing",completed:"completed",on_hold:"on-hold",
  refunded:"refunded",cancelled:"cancelled",failed:"failed",expired:"failed",pending:"pending",trash:"trash"
};

export function wooStatus(row:{status:string;expires_at?:Date|string|null}){
  if(row.status==="pending"&&row.expires_at&&new Date(row.expires_at).getTime()<Date.now()) return "failed";
  return LOCAL_TO_WOO[row.status]||String(row.status||"pending").replace(/_/g,"-");
}

export function localStatusFromWoo(status:string){
  const value=String(status||"").toLowerCase();
  const map:Record<string,string>={processing:"processing",completed:"completed","on-hold":"on_hold",refunded:"refunded",cancelled:"cancelled",failed:"failed",pending:"pending"};
  return map[value]||null;
}

/** SQL fragment matching one Woo status against local rows (alias o). */
export function statusSql(status:string){
  switch(status){
    case "processing": return "o.status IN ('paid','processing')";
    case "completed": return "o.status='completed'";
    case "on-hold": return "o.status='on_hold'";
    case "refunded": return "o.status='refunded'";
    case "cancelled": return "o.status='cancelled'";
    case "pending": return "(o.status='pending' AND (o.expires_at IS NULL OR o.expires_at>now()))";
    case "failed": return "(o.status IN ('failed','expired') OR (o.status='pending' AND o.expires_at<=now()))";
    case "trash": return "o.status='trash'";
    default: return null;
  }
}

// ── Product identifiers ─────────────────────────────────────────────────────

/** Woo needs integer IDs. Woo-origin IDs pass through; admin-created products get a stable number. */
export async function numericProductIds(ids:string[]){
  await ensureBridgeSchema();
  const result=new Map<string,number>();
  const unmapped:string[]=[];
  for(const id of ids){
    const match=String(id).match(/^(\d+)(?:-\d+)?$/);
    if(match) result.set(id,Number(match[1]));
    else if(id) unmapped.push(id);
  }
  if(unmapped.length){
    await db().query(
      "INSERT INTO bridge_product_ids (product_id) SELECT unnest($1::text[]) ON CONFLICT (product_id) DO NOTHING",
      [Array.from(new Set(unmapped))]
    );
    const rows=await db().query("SELECT product_id,numeric_id FROM bridge_product_ids WHERE product_id=ANY($1::text[])",[unmapped]);
    for(const row of rows.rows) result.set(String(row.product_id),Number(row.numeric_id));
  }
  return result;
}

// ── Order serialisation ─────────────────────────────────────────────────────

export type OrderRow=Record<string,any>;

const ORDER_COLUMNS=`o.*`;

export async function loadOrders(where:string,params:unknown[],tail=""){
  await ensureBridgeSchema();
  const orders=await db().query(`SELECT ${ORDER_COLUMNS} FROM orders o WHERE ${where} ${tail}`,params);
  return serialiseOrders(orders.rows);
}

export async function loadOrderByNumber(orderNumber:number){
  const [order]=await loadOrders("o.order_number=$1",[orderNumber]);
  return order||null;
}

export async function loadOrderById(id:string){
  const [order]=await loadOrders("o.id=$1",[id]);
  return order||null;
}

export async function serialiseOrders(rows:OrderRow[]){
  if(!rows.length) return [];
  const ids=rows.map((row)=>row.id);
  const [items,refunds]=await Promise.all([
    db().query("SELECT * FROM order_items WHERE order_id=ANY($1::uuid[]) ORDER BY id",[ids]),
    db().query("SELECT * FROM order_refunds WHERE order_id=ANY($1::uuid[]) ORDER BY id",[ids])
  ]);
  const productIds=await numericProductIds(items.rows.map((item)=>String(item.product_id)));
  const itemsByOrder=new Map<string,OrderRow[]>();
  for(const item of items.rows){
    const list=itemsByOrder.get(item.order_id)||[];
    list.push(item);
    itemsByOrder.set(item.order_id,list);
  }
  const refundsByOrder=new Map<string,OrderRow[]>();
  for(const refund of refunds.rows){
    const list=refundsByOrder.get(refund.order_id)||[];
    list.push(refund);
    refundsByOrder.set(refund.order_id,list);
  }
  return rows.map((row)=>toWooOrder(row,itemsByOrder.get(row.id)||[],refundsByOrder.get(row.id)||[],productIds));
}

function addressFromCustomer(customer:Record<string,any>,withAddress:boolean){
  const name=splitName(customer.name||"");
  return {
    first_name:customer.first_name||name.first,
    last_name:customer.last_name||name.last,
    company:"",
    address_1:withAddress?String(customer.address1||""):"",
    address_2:withAddress?String(customer.address2||""):"",
    city:withAddress?String(customer.city||""):"",
    state:"",
    postcode:withAddress?String(customer.postcode||""):"",
    country:withAddress&&customer.postcode?"GB":"",
    email:String(customer.email||""),
    phone:String(customer.phone||"")
  };
}

/** Woo refund objects already recorded on an imported Woo order. */
function importedRefunds(row:OrderRow){
  const list=Array.isArray(row.source_meta?.refunds)?row.source_meta.refunds:[];
  return list.map((refund:any)=>({
    id:Number(refund.id)||0,
    reason:String(refund.reason||""),
    total:"-"+Math.abs(Number(refund.total)||0).toFixed(2),
    amountPence:Math.abs(penceFromMoney(refund.total))
  }));
}

export function refundedPence(row:OrderRow,refunds:OrderRow[]){
  return refunds.reduce((sum,refund)=>sum+Number(refund.amount_pence||0),0)+
    importedRefunds(row).reduce((sum:number,refund:{amountPence:number})=>sum+refund.amountPence,0);
}

export function toWooOrder(row:OrderRow,items:OrderRow[],refunds:OrderRow[],productIds:Map<string,number>){
  const meta=row.source_meta||{};
  const customer=row.customer||{};
  const imported=row.source==="woo";
  const id=Number(row.order_number||row.woo_order_id||0);
  const created=wooDates(row.created_at);
  const modified=wooDates(row.updated_at||row.created_at);
  const paid=wooDates(row.date_paid);
  const completed=wooDates(row.date_completed);
  const delivery=row.fulfilment==="delivery";

  const billing=imported&&row.billing_address&&Object.keys(row.billing_address).length
    ? row.billing_address
    : addressFromCustomer(customer,true);
  const shipping=imported&&row.shipping_address&&Object.keys(row.shipping_address).length
    ? row.shipping_address
    : (()=>{const value=addressFromCustomer(customer,delivery);delete (value as any).email;return value;})();

  const lineItems=items.map((item)=>{
    const productId=productIds.get(String(item.product_id))??0;
    const totalPence=item.total_pence??Number(item.unit_price_pence||0)*Number(item.quantity||0);
    const subtotalPence=item.subtotal_pence??totalPence;
    return {
      id:Number(item.woo_line_item_id||item.id),
      name:String(item.name),
      product_id:productId,
      variation_id:Number(item.woo_variation_id||0),
      quantity:Number(item.quantity||0),
      tax_class:"",
      subtotal:money(subtotalPence),
      subtotal_tax:"0.00",
      total:money(totalPence),
      total_tax:"0.00",
      taxes:[],
      meta_data:Array.isArray(item.source_meta?.meta_data)?item.source_meta.meta_data:[],
      sku:String(item.sku||""),
      price:Number(item.quantity)?Number(money(totalPence))/Number(item.quantity):0
    };
  });

  const shippingLines=imported&&Array.isArray(meta.shipping_lines)
    ? meta.shipping_lines
    : row.fulfilment==="electronic"
      ? []
      : [{
          id:1,
          method_title:delivery?"Delivery":"Local pickup",
          method_id:delivery?"flat_rate":"local_pickup",
          instance_id:"",
          total:money(row.shipping_pence),
          total_tax:"0.00",
          taxes:[],
          meta_data:[]
        }];

  const feeLines=imported&&Array.isArray(meta.fee_lines)
    ? meta.fee_lines
    : Number(row.donation_pence)>0
      ? [{id:1,name:"Christmas Giving donation",tax_class:"",tax_status:"none",total:money(row.donation_pence),total_tax:"0.00",taxes:[],meta_data:[]}]
      : [];

  const couponLines=imported&&Array.isArray(meta.coupon_lines)
    ? meta.coupon_lines
    : row.coupon_code
      ? [{id:1,code:String(row.coupon_code).toLowerCase(),discount:money(row.discount_pence),discount_tax:"0.00",meta_data:[]}]
      : [];

  const refundList=[
    ...importedRefunds(row).map((refund:{id:number;reason:string;total:string})=>({id:refund.id,reason:refund.reason,total:refund.total})),
    ...refunds.map((refund)=>({id:Number(refund.id),reason:String(refund.reason||""),total:"-"+money(refund.amount_pence)}))
  ];

  const nativeMeta=[
    {id:1,key:"delivery_method",value:row.fulfilment==="delivery"?"Delivery":row.fulfilment==="collection"?"Collection":"Electronic"},
    {id:2,key:"_sk_menu_week_start",value:String(row.cycle_key instanceof Date?DateTime.fromJSDate(row.cycle_key).toISODate():row.cycle_key||"")},
    {id:3,key:"_sk_fulfilment_date",value:String(row.fulfilment_date instanceof Date?DateTime.fromJSDate(row.fulfilment_date).toISODate():row.fulfilment_date||"")},
    ...(meta.subscription_id?[{id:4,key:"_sk_stripe_subscription",value:String(meta.subscription_id)}]:[]),
    ...(meta.created_via==="subscription"?[{id:5,key:"_subscription_renewal",value:String(meta.subscription_id||"")}]:[])
  ];

  const transactionId=row.stripe_payment_intent_id||meta.transaction_id||"";

  return {
    id,
    parent_id:Number(row.woo_parent_order_id||0),
    status:wooStatus(row as {status:string;expires_at?:Date|string|null}),
    currency:String(row.currency||"GBP"),
    version:"simple-kitchen",
    prices_include_tax:false,
    date_created:created.local,
    date_modified:modified.local,
    discount_total:money(row.discount_pence),
    discount_tax:"0.00",
    shipping_total:money(row.shipping_pence),
    shipping_tax:"0.00",
    cart_tax:"0.00",
    total:money(row.total_pence),
    total_tax:"0.00",
    customer_id:Number(row.woo_customer_id||0),
    order_key:String(row.woo_order_key||"wc_order_"+String(row.id).replace(/-/g,"").slice(0,13)),
    billing,
    shipping,
    payment_method:String(row.payment_method||"stripe"),
    payment_method_title:String(row.payment_method_title||"Credit / Debit Card"),
    transaction_id:String(transactionId),
    customer_ip_address:"",
    customer_user_agent:"",
    created_via:String(meta.created_via||"checkout"),
    customer_note:String(meta.customer_note||customer.note||""),
    date_completed:completed.local,
    date_paid:paid.local,
    cart_hash:"",
    number:String(row.woo_order_number||id),
    meta_data:imported&&Array.isArray(meta.meta_data)?meta.meta_data:nativeMeta,
    line_items:lineItems,
    tax_lines:[],
    shipping_lines:shippingLines,
    fee_lines:feeLines,
    coupon_lines:couponLines,
    refunds:refundList,
    payment_url:"",
    is_editable:false,
    needs_payment:false,
    needs_processing:true,
    date_created_gmt:created.gmt,
    date_modified_gmt:modified.gmt,
    date_completed_gmt:completed.gmt,
    date_paid_gmt:paid.gmt,
    currency_symbol:"£"
  };
}

// ── Webhooks to the kitchen system ─────────────────────────────────────────

/**
 * Sends a Woo-format signed webhook so admin imports the order immediately.
 * admin also polls every few minutes, so a failed delivery only delays it.
 */
export async function notifyKitchen(orderId:string,topic:"order.created"|"order.updated"="order.updated"){
  const url=process.env.KITCHEN_WEBHOOK_URL||"";
  const secret=process.env.KITCHEN_WEBHOOK_SECRET||"";
  if(!url||!secret) return false;
  try{
    const order=await loadOrderById(orderId);
    if(!order) return false;
    const body=JSON.stringify(order);
    const signature=crypto.createHmac("sha256",secret).update(body,"utf8").digest("base64");
    const [resource,event]=topic.split(".");
    const response=await fetch(url,{
      method:"POST",
      headers:{
        "content-type":"application/json",
        "user-agent":"WooCommerce/9.0 Hookshot (Simple Kitchen storefront)",
        "x-wc-webhook-source":config.siteUrl+"/",
        "x-wc-webhook-topic":topic,
        "x-wc-webhook-resource":resource,
        "x-wc-webhook-event":event,
        "x-wc-webhook-signature":signature,
        "x-wc-webhook-id":"1",
        "x-wc-webhook-delivery-id":crypto.randomUUID()
      },
      body,
      signal:AbortSignal.timeout(8000)
    });
    if(!response.ok) console.error("[kitchen-webhook] "+topic+" for order "+order.id+" returned HTTP "+response.status);
    return response.ok;
  }catch(error){
    console.error("[kitchen-webhook] delivery failed:",error instanceof Error?error.message:error);
    return false;
  }
}

/** Fire-and-forget variant for code paths that must not wait on the kitchen system. */
export function notifyKitchenLater(orderId:string|null|undefined,topic:"order.created"|"order.updated"="order.updated"){
  if(!orderId) return;
  void notifyKitchen(orderId,topic).catch(()=>undefined);
}
