import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const {Pool}=pg;
const base=(process.env.WOO_SOURCE_URL||"https://simplekitchenprep.com").replace(/\/$/,"");
const key=process.env.WOO_CONSUMER_KEY;
const secret=process.env.WOO_CONSUMER_SECRET;
const databaseUrl=process.env.DATABASE_URL;
if(!key||!secret) throw new Error("Woo credentials are missing from .env");
if(!databaseUrl) throw new Error("DATABASE_URL is missing from .env");

const auth=Buffer.from(key+":"+secret).toString("base64");
const headers={authorization:"Basic "+auth,"user-agent":"Simple-Kitchen-History-Migration/1.0",accept:"application/json"};
const pool=new Pool({connectionString:databaseUrl,max:4});

function api(endpoint,params={}){
  const url=new URL(base+"/wp-json/wc/v3/"+endpoint.replace(/^\//,""));
  for(const [name,value] of Object.entries(params)) if(value!=null&&value!=="") url.searchParams.set(name,String(value));
  return url;
}

async function get(url,optional=false){
  const response=await fetch(url,{headers});
  if(optional&&[401,403,404].includes(response.status)) return null;
  if(!response.ok) throw new Error(response.status+" "+response.statusText+" for "+url.pathname+url.search);
  return response.json();
}

const PAGE_SIZE=Math.min(100,Math.max(10,Number.parseInt(process.env.WOO_HISTORY_PAGE_SIZE||"50",10)||50));
const CHECKPOINT_PATH=path.resolve("data","woo-history-checkpoint.json");

async function loadCheckpoint(){
  if(process.argv.includes("--reset-checkpoint")){
    await fs.rm(CHECKPOINT_PATH,{force:true}).catch(()=>undefined);
    console.log("Woo history checkpoint reset.");
  }
  try{
    return JSON.parse(await fs.readFile(CHECKPOINT_PATH,"utf8"));
  }catch{
    return {version:1,source:base,stages:{}};
  }
}

async function saveCheckpoint(checkpoint){
  await fs.mkdir(path.dirname(CHECKPOINT_PATH),{recursive:true});
  checkpoint.updatedAt=new Date().toISOString();
  await fs.writeFile(CHECKPOINT_PATH,JSON.stringify(checkpoint,null,2));
}

async function paged(endpoint,params={},optional=false){
  const rows=[];
  for(let page=1;;page++){
    const batch=await get(api(endpoint,{...params,per_page:PAGE_SIZE,page}),optional);
    if(batch==null) return null;
    if(!Array.isArray(batch)) throw new Error("Unexpected response from "+endpoint);
    rows.push(...batch);
    if(batch.length<PAGE_SIZE) break;
  }
  return rows;
}

async function processStage(checkpoint,stage,endpoint,params,handler,optional=false){
  const state=checkpoint.stages[stage]||{};
  if(state.complete){
    console.log("\n"+stage+": already complete ("+Number(state.processed||0)+" records).");
    return {processed:Number(state.processed||0),available:state.available!==false};
  }

  let page=Math.max(1,Number(state.nextPage||1));
  let processed=Math.max(0,Number(state.processed||0));
  console.log("\n"+stage+": resuming from Woo page "+page+" (page size "+PAGE_SIZE+")");

  for(;;page++){
    const batch=await get(api(endpoint,{...params,per_page:PAGE_SIZE,page}),optional);
    if(batch==null){
      checkpoint.stages[stage]={...state,available:false,complete:true,nextPage:page,processed};
      await saveCheckpoint(checkpoint);
      return {processed,available:false};
    }
    if(!Array.isArray(batch)) throw new Error("Unexpected response from "+endpoint);

    console.log(stage+": page "+page+" fetched "+batch.length+" records");
    for(let index=0;index<batch.length;index++){
      await handler(batch[index],{page,index});
      processed++;
      if(processed%25===0) console.log(stage+": "+processed+" processed");
    }

    const complete=batch.length<PAGE_SIZE;
    checkpoint.stages[stage]={
      available:true,complete,nextPage:complete?page:page+1,processed,
      lastPage:page,lastBatchSize:batch.length
    };
    await saveCheckpoint(checkpoint);
    console.log(stage+": page "+page+" committed; checkpoint saved.");

    if(complete) return {processed,available:true};
  }
}

function pence(value){
  const parsed=Number(value);
  return Number.isFinite(parsed)?Math.round(parsed*100):0;
}

function iso(value){
  if(!value) return null;
  const raw=String(value).trim();
  if(!raw) return null;
  const withZone=/[zZ]|[+-]\d\d:?\d\d$/.test(raw)?raw:(raw.length===10?raw+"T12:00:00Z":raw+"Z");
  const date=new Date(withZone);
  return Number.isFinite(date.getTime())?date.toISOString():null;
}

function dateOnly(value,fallback){
  const parsed=iso(value)||iso(fallback)||new Date().toISOString();
  return parsed.slice(0,10);
}

function metaValue(meta,needles){
  const wanted=needles.map((value)=>String(value).toLowerCase());
  for(const item of Array.isArray(meta)?meta:[]){
    const key=String(item?.key||item?.display_key||"").toLowerCase();
    if(wanted.some((needle)=>key===needle||key.includes(needle))){
      const value=item?.value??item?.display_value;
      if(value!=null&&String(value).trim()!=="") return value;
    }
  }
  return null;
}

function normalisePhone(value){
  let phone=String(value||"").trim().replace(/[\s()-]/g,"");
  if(!phone) return "";
  if(phone.startsWith("00")) phone="+"+phone.slice(2);
  if(phone.startsWith("07")) phone="+44"+phone.slice(1);
  else if(phone.startsWith("447")) phone="+"+phone;
  return phone;
}

function customerFrom(order){
  const billing=order.billing||{};
  const shipping=order.shipping||{};
  return {
    name:[billing.first_name,billing.last_name].filter(Boolean).join(" ")||[shipping.first_name,shipping.last_name].filter(Boolean).join(" "),
    email:String(billing.email||"").trim().toLowerCase(),
    phone:String(billing.phone||""),
    address1:String(shipping.address_1||billing.address_1||""),
    address2:String(shipping.address_2||billing.address_2||""),
    city:String(shipping.city||billing.city||""),
    postcode:String(shipping.postcode||billing.postcode||""),
    state:String(shipping.state||billing.state||""),
    country:String(shipping.country||billing.country||""),
    wooCustomerId:String(order.customer_id||"")
  };
}

function orderStatus(value){
  const raw=String(value||"pending").toLowerCase();
  if(raw==="on-hold") return "on_hold";
  return raw.replaceAll("-","_");
}

function subscriptionStatus(value){
  const raw=String(value||"pending").toLowerCase();
  if(raw==="on-hold") return "paused";
  if(raw==="pending-cancel") return "pending_cancel";
  return raw.replaceAll("-","_");
}

function fulfilmentFrom(order){
  const items=Array.isArray(order.line_items)?order.line_items:[];
  if(items.length&&items.every((item)=>Number(item.product_id)===358)) return "electronic";
  const shippingLines=Array.isArray(order.shipping_lines)?order.shipping_lines:[];
  const methodText=shippingLines.map((line)=>[line.method_id,line.method_title,line.instance_id].join(" ")).join(" ").toLowerCase();
  if(/local.?pickup|collection|collect|pickup/.test(methodText)) return "collection";
  const shipping=order.shipping||{};
  if(String(shipping.postcode||"").trim()||shippingLines.length||Number(order.shipping_total||0)>0) return "delivery";
  return "collection";
}

function deliveryDateFrom(order){
  const value=metaValue(order.meta_data,[
    "delivery_date","delivery date","orddd","delivery-date","delivery_day","delivery day","collection_date","collection date"
  ]);
  return dateOnly(value,order.date_created_gmt||order.date_created);
}

function sourcePlan(subscription){
  const lines=Array.isArray(subscription.line_items)?subscription.line_items:[];
  const first=lines[0]||{};
  const productId=Number(first.product_id||0);
  const name=String(first.name||"").toLowerCase();
  if(productId===291) return "weekly";
  if(productId===764) return "fortnightly";
  if(productId===4744) return "twice-weekly";
  if(name.includes("twice")||name.includes("2x")) return "twice-weekly";
  if(name.includes("fortnight")) return "fortnightly";
  if(String(subscription.billing_period||"").toLowerCase()==="week"&&Number(subscription.billing_interval||1)===2) return "fortnightly";
  return productId?"woo-"+productId:"weekly";
}

function cadenceWeeks(subscription,plan){
  if(plan==="fortnightly") return 2;
  const period=String(subscription.billing_period||"").toLowerCase();
  const interval=Math.max(1,Number(subscription.billing_interval)||1);
  return period==="week"?interval:1;
}

function mealsFromLine(line){
  const meta=Array.isArray(line?.meta_data)?line.meta_data:[];
  for(const item of meta){
    const key=String(item?.key||item?.display_key||"").toLowerCase();
    const value=String(item?.value??item?.display_value??"").trim();
    if(/meal|quantity|qty/.test(key)){
      const parsed=Number(value.match(/\d+/)?.[0]);
      if(Number.isFinite(parsed)&&parsed>0&&parsed<=60) return parsed;
    }
  }
  const fromName=Number(String(line?.name||"").match(/(\d+)\s*meal/i)?.[1]);
  if(Number.isFinite(fromName)&&fromName>0&&fromName<=60) return fromName;
  return Math.max(1,Number(line?.quantity)||1);
}

function subscriptionStripeIds(subscription){
  const meta=Array.isArray(subscription.meta_data)?subscription.meta_data:[];
  const paymentPostMeta=subscription.payment_details?.post_meta||{};
  return {
    stripeSubscriptionId:String(
      metaValue(meta,["_stripe_subscription_id","stripe_subscription_id"])||
      paymentPostMeta._stripe_subscription_id||""
    ).trim()||null,
    stripeCustomerId:String(
      metaValue(meta,["_stripe_customer_id","stripe_customer_id"])||
      paymentPostMeta._stripe_customer_id||""
    ).trim()||null
  };
}

async function ensureSchema(){
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfilment_check;
    ALTER TABLE orders ADD CONSTRAINT orders_fulfilment_check CHECK (fulfilment IN ('collection','delivery','electronic'));

    ALTER TABLE orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'native';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS woo_order_id bigint;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS woo_parent_order_id bigint;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS woo_customer_id bigint;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS woo_order_number text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS woo_order_key text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method_title text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS date_paid timestamptz;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS date_completed timestamptz;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address jsonb;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address jsonb;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_meta jsonb;
    CREATE UNIQUE INDEX IF NOT EXISTS orders_woo_order_unique_idx ON orders (woo_order_id) WHERE woo_order_id IS NOT NULL;

    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS woo_line_item_id bigint;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS woo_variation_id bigint;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku text;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS subtotal_pence integer;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_pence integer;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS source_meta jsonb;
    CREATE UNIQUE INDEX IF NOT EXISTS order_items_woo_line_unique_idx ON order_items (order_id,woo_line_item_id) WHERE woo_line_item_id IS NOT NULL;

    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cadence_weeks integer NOT NULL DEFAULT 1;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS source_plan text NOT NULL DEFAULT 'weekly';
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS selection_token uuid NOT NULL DEFAULT gen_random_uuid();
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_address jsonb;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_zone text;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_fee_pence integer NOT NULL DEFAULT 0;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id text;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS customer_name text;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

    CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_selection_token_unique_idx ON subscriptions (selection_token);

    ALTER TABLE subscriptions ALTER COLUMN stripe_subscription_id DROP NOT NULL;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'stripe';
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS woo_subscription_id bigint;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS woo_parent_order_id bigint;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS woo_customer_id bigint;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method text;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method_title text;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_period text;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_interval integer;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_payment_at timestamptz;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_payment_at timestamptz;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS ended_at timestamptz;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_address jsonb;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS shipping_address jsonb;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS source_meta jsonb;
    CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_woo_unique_idx ON subscriptions (woo_subscription_id) WHERE woo_subscription_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS subscription_history (
      id bigserial PRIMARY KEY,
      subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      source text NOT NULL DEFAULT 'woo',
      event_type text NOT NULL,
      occurred_at timestamptz NOT NULL,
      message text,
      woo_note_id bigint,
      woo_order_id bigint,
      payload jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS subscription_history_woo_note_unique_idx
      ON subscription_history (subscription_id,woo_note_id) WHERE woo_note_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS subscription_history_woo_order_unique_idx
      ON subscription_history (subscription_id,woo_order_id,event_type) WHERE woo_order_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS woo_customers (
      woo_customer_id bigint PRIMARY KEY,
      email text,
      first_name text,
      last_name text,
      username text,
      phone text,
      billing jsonb,
      shipping jsonb,
      date_created timestamptz,
      date_modified timestamptz,
      source_meta jsonb,
      imported_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS woo_customers_email_idx ON woo_customers (lower(email));

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
  `);
}

async function importCustomer(customer){
  const billing=customer.billing||{};
  await pool.query(
    `INSERT INTO woo_customers
      (woo_customer_id,email,first_name,last_name,username,phone,billing,shipping,date_created,date_modified,source_meta,imported_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11::jsonb,now())
     ON CONFLICT (woo_customer_id) DO UPDATE SET
       email=EXCLUDED.email,first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,username=EXCLUDED.username,
       phone=EXCLUDED.phone,billing=EXCLUDED.billing,shipping=EXCLUDED.shipping,date_created=EXCLUDED.date_created,
       date_modified=EXCLUDED.date_modified,source_meta=EXCLUDED.source_meta,imported_at=now()`,
    [
      Number(customer.id),String(customer.email||billing.email||"").toLowerCase(),String(customer.first_name||billing.first_name||""),
      String(customer.last_name||billing.last_name||""),String(customer.username||""),String(billing.phone||""),
      JSON.stringify(customer.billing||{}),JSON.stringify(customer.shipping||{}),
      iso(customer.date_created_gmt||customer.date_created),iso(customer.date_modified_gmt||customer.date_modified),
      JSON.stringify({role:customer.role,is_paying_customer:customer.is_paying_customer,meta_data:customer.meta_data||[]})
    ]
  );
}

async function importOrder(order){
  const customer=customerFrom(order);
  const fulfilment=fulfilmentFrom(order);
  const created=iso(order.date_created_gmt||order.date_created)||new Date().toISOString();
  const fulfilmentDate=deliveryDateFrom(order);
  const lineItems=Array.isArray(order.line_items)?order.line_items:[];
  const subtotalPence=lineItems.reduce((sum,item)=>sum+pence(item.subtotal),0);
  const donationPence=(order.fee_lines||[]).reduce((sum,fee)=>{
    const name=String(fee.name||"").toLowerCase();
    return /donation|giving|christmas/.test(name)?sum+pence(fee.total):sum;
  },0);
  const couponCode=String(order.coupon_lines?.[0]?.code||"")||null;
  const status=orderStatus(order.status);
  const sourceMeta={
    created_via:order.created_via,version:order.version,customer_note:order.customer_note,
    coupon_lines:order.coupon_lines||[],fee_lines:order.fee_lines||[],shipping_lines:order.shipping_lines||[],
    refunds:order.refunds||[],meta_data:order.meta_data||[]
  };

  const result=await pool.query(
    `INSERT INTO orders
      (created_at,updated_at,cycle_key,fulfilment_date,status,fulfilment,subtotal_pence,shipping_pence,
       donation_pence,matched_donation_pence,discount_pence,coupon_code,total_pence,customer,
       source,woo_order_id,woo_parent_order_id,woo_customer_id,woo_order_number,woo_order_key,currency,
       payment_method,payment_method_title,date_paid,date_completed,billing_address,shipping_address,source_meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12,$13::jsonb,'woo',$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,$25::jsonb,$26::jsonb)
     ON CONFLICT (woo_order_id) WHERE woo_order_id IS NOT NULL DO UPDATE SET
       updated_at=EXCLUDED.updated_at,status=EXCLUDED.status,fulfilment_date=EXCLUDED.fulfilment_date,
       fulfilment=EXCLUDED.fulfilment,subtotal_pence=EXCLUDED.subtotal_pence,shipping_pence=EXCLUDED.shipping_pence,
       donation_pence=EXCLUDED.donation_pence,matched_donation_pence=EXCLUDED.matched_donation_pence,
       discount_pence=EXCLUDED.discount_pence,coupon_code=EXCLUDED.coupon_code,total_pence=EXCLUDED.total_pence,
       customer=EXCLUDED.customer,woo_parent_order_id=EXCLUDED.woo_parent_order_id,woo_customer_id=EXCLUDED.woo_customer_id,
       woo_order_number=EXCLUDED.woo_order_number,woo_order_key=EXCLUDED.woo_order_key,currency=EXCLUDED.currency,
       payment_method=EXCLUDED.payment_method,payment_method_title=EXCLUDED.payment_method_title,
       date_paid=EXCLUDED.date_paid,date_completed=EXCLUDED.date_completed,billing_address=EXCLUDED.billing_address,
       shipping_address=EXCLUDED.shipping_address,source_meta=EXCLUDED.source_meta
     RETURNING id`,
    [
      created,iso(order.date_modified_gmt||order.date_modified)||created,dateOnly(created,created),fulfilmentDate,status,fulfilment,
      subtotalPence,pence(order.shipping_total),donationPence,pence(order.discount_total),couponCode,pence(order.total),JSON.stringify(customer),
      Number(order.id),Number(order.parent_id||0)||null,Number(order.customer_id||0)||null,String(order.number||order.id),String(order.order_key||""),
      String(order.currency||"GBP"),String(order.payment_method||""),String(order.payment_method_title||""),
      iso(order.date_paid_gmt||order.date_paid),iso(order.date_completed_gmt||order.date_completed),
      JSON.stringify(order.billing||{}),JSON.stringify(order.shipping||{}),JSON.stringify(sourceMeta)
    ]
  );
  const orderId=result.rows[0].id;

  await pool.query("DELETE FROM order_items WHERE order_id=$1",[orderId]);
  for(const item of lineItems){
    const quantity=Math.max(1,Number(item.quantity)||1);
    const total=pence(item.total);
    const subtotal=pence(item.subtotal);
    const unit=quantity?Math.round((total||subtotal)/quantity):0;
    await pool.query(
      `INSERT INTO order_items
        (order_id,product_id,name,unit_price_pence,quantity,woo_line_item_id,woo_variation_id,sku,subtotal_pence,total_pence,source_meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
      [
        orderId,String(item.product_id||item.variation_id||"0"),String(item.name||"Product"),unit,quantity,
        Number(item.id||0)||null,Number(item.variation_id||0)||null,String(item.sku||""),subtotal,total,
        JSON.stringify({taxes:item.taxes||[],meta_data:item.meta_data||[]})
      ]
    );
  }

  const phone=normalisePhone(customer.phone);
  if(phone){
    await pool.query(
      `INSERT INTO sms_audience (phone_normalized,phone_raw,email,first_name,last_name,last_order_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (phone_normalized) DO UPDATE SET
         phone_raw=EXCLUDED.phone_raw,email=COALESCE(NULLIF(EXCLUDED.email,''),sms_audience.email),
         first_name=COALESCE(NULLIF(EXCLUDED.first_name,''),sms_audience.first_name),
         last_name=COALESCE(NULLIF(EXCLUDED.last_name,''),sms_audience.last_name),
         last_order_at=GREATEST(sms_audience.last_order_at,EXCLUDED.last_order_at),updated_at=now()`,
      [phone,customer.phone,customer.email,String(order.billing?.first_name||""),String(order.billing?.last_name||""),created]
    );
  }
  return orderId;
}

async function importSubscription(subscription){
  const billing=subscription.billing||{};
  const shipping=subscription.shipping||{};
  const line=(subscription.line_items||[])[0]||{};
  const plan=sourcePlan(subscription);
  const meals=mealsFromLine(line);
  const fulfilment=fulfilmentFrom(subscription)==="delivery"?"delivery":"collection";
  const stripe=subscriptionStripeIds(subscription);
  const created=iso(subscription.date_created_gmt||subscription.date_created||subscription.start_date_gmt||subscription.start_date)||new Date().toISOString();

  const result=await pool.query(
    `INSERT INTO subscriptions
      (created_at,updated_at,status,stripe_subscription_id,stripe_customer_id,customer_email,customer_name,
       meals_per_week,fulfilment,cadence_weeks,source_plan,delivery_address,delivery_fee_pence,source,
       woo_subscription_id,woo_parent_order_id,woo_customer_id,payment_method,payment_method_title,billing_period,billing_interval,
       next_payment_at,last_payment_at,cancelled_at,ended_at,billing_address,shipping_address,source_meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,'woo',$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25::jsonb,$26::jsonb,$27::jsonb)
     ON CONFLICT (woo_subscription_id) WHERE woo_subscription_id IS NOT NULL DO UPDATE SET
       updated_at=EXCLUDED.updated_at,status=EXCLUDED.status,
       stripe_subscription_id=COALESCE(EXCLUDED.stripe_subscription_id,subscriptions.stripe_subscription_id),
       stripe_customer_id=COALESCE(EXCLUDED.stripe_customer_id,subscriptions.stripe_customer_id),
       customer_email=EXCLUDED.customer_email,customer_name=EXCLUDED.customer_name,meals_per_week=EXCLUDED.meals_per_week,
       fulfilment=EXCLUDED.fulfilment,cadence_weeks=EXCLUDED.cadence_weeks,source_plan=EXCLUDED.source_plan,
       delivery_address=EXCLUDED.delivery_address,delivery_fee_pence=EXCLUDED.delivery_fee_pence,
       woo_parent_order_id=EXCLUDED.woo_parent_order_id,woo_customer_id=EXCLUDED.woo_customer_id,
       payment_method=EXCLUDED.payment_method,payment_method_title=EXCLUDED.payment_method_title,
       billing_period=EXCLUDED.billing_period,billing_interval=EXCLUDED.billing_interval,next_payment_at=EXCLUDED.next_payment_at,
       last_payment_at=EXCLUDED.last_payment_at,cancelled_at=EXCLUDED.cancelled_at,ended_at=EXCLUDED.ended_at,
       billing_address=EXCLUDED.billing_address,shipping_address=EXCLUDED.shipping_address,source_meta=EXCLUDED.source_meta
     RETURNING id,selection_token`,
    [
      created,iso(subscription.date_modified_gmt||subscription.date_modified)||created,subscriptionStatus(subscription.status),
      null,stripe.stripeCustomerId,String(billing.email||"").toLowerCase(),
      [billing.first_name,billing.last_name].filter(Boolean).join(" "),meals,fulfilment,cadenceWeeks(subscription,plan),plan,
      JSON.stringify(shipping),pence(subscription.shipping_total),Number(subscription.id),Number(subscription.parent_id||0)||null,
      Number(subscription.customer_id||0)||null,String(subscription.payment_method||""),String(subscription.payment_method_title||""),
      String(subscription.billing_period||""),Math.max(1,Number(subscription.billing_interval)||1),
      iso(subscription.next_payment_date_gmt||subscription.next_payment_date),
      iso(subscription.last_payment_date_gmt||subscription.last_payment_date),
      iso(subscription.cancelled_date_gmt||subscription.cancelled_date),
      iso(subscription.end_date_gmt||subscription.end_date),
      JSON.stringify(billing),JSON.stringify(shipping),
      JSON.stringify({
        legacy_stripe_subscription_id:stripe.stripeSubscriptionId,line_items:subscription.line_items||[],coupon_lines:subscription.coupon_lines||[],fee_lines:subscription.fee_lines||[],
        shipping_lines:subscription.shipping_lines||[],meta_data:subscription.meta_data||[],
        trial_end_date_gmt:subscription.trial_end_date_gmt,resubscribed_from:subscription.resubscribed_from,
        resubscribed_subscription:subscription.resubscribed_subscription
      })
    ]
  );
  const localId=result.rows[0].id;

  await pool.query(
    `INSERT INTO subscription_history (subscription_id,source,event_type,occurred_at,message,payload)
     SELECT $1,'woo','created',$2,$3,$4::jsonb
     WHERE NOT EXISTS (
       SELECT 1 FROM subscription_history WHERE subscription_id=$1 AND event_type='created' AND source='woo'
     )`,
    [localId,created,"Imported Woo subscription #"+subscription.id,JSON.stringify({status:subscription.status})]
  );

  const relatedOrders=(await paged("subscriptions/"+subscription.id+"/orders",{},true))||[];
  for(const order of relatedOrders){
    await importOrder(order);
    await pool.query(
      `INSERT INTO subscription_history (subscription_id,source,event_type,occurred_at,message,woo_order_id,payload)
       VALUES ($1,'woo','order',$2,$3,$4,$5::jsonb)
       ON CONFLICT (subscription_id,woo_order_id,event_type) WHERE woo_order_id IS NOT NULL DO UPDATE SET
         occurred_at=EXCLUDED.occurred_at,message=EXCLUDED.message,payload=EXCLUDED.payload`,
      [
        localId,iso(order.date_created_gmt||order.date_created)||created,
        "Woo order #"+String(order.number||order.id)+" — "+String(order.status||""),
        Number(order.id),JSON.stringify({status:order.status,total:order.total,currency:order.currency})
      ]
    );
  }

  const notes=(await paged("subscriptions/"+subscription.id+"/notes",{},true))||[];
  for(const note of notes){
    await pool.query(
      `INSERT INTO subscription_history (subscription_id,source,event_type,occurred_at,message,woo_note_id,payload)
       VALUES ($1,'woo','note',$2,$3,$4,$5::jsonb)
       ON CONFLICT (subscription_id,woo_note_id) WHERE woo_note_id IS NOT NULL DO UPDATE SET
         occurred_at=EXCLUDED.occurred_at,message=EXCLUDED.message,payload=EXCLUDED.payload`,
      [
        localId,iso(note.date_created_gmt||note.date_created)||created,String(note.note||""),Number(note.id),
        JSON.stringify({author:note.author,customer_note:note.customer_note})
      ]
    );
  }

  const phone=normalisePhone(billing.phone);
  if(phone){
    await pool.query(
      `INSERT INTO sms_audience (phone_normalized,phone_raw,email,first_name,last_name,active_subscription)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (phone_normalized) DO UPDATE SET
         phone_raw=EXCLUDED.phone_raw,email=COALESCE(NULLIF(EXCLUDED.email,''),sms_audience.email),
         first_name=COALESCE(NULLIF(EXCLUDED.first_name,''),sms_audience.first_name),
         last_name=COALESCE(NULLIF(EXCLUDED.last_name,''),sms_audience.last_name),
         active_subscription=EXCLUDED.active_subscription,updated_at=now()`,
      [
        phone,String(billing.phone||""),String(billing.email||"").toLowerCase(),String(billing.first_name||""),String(billing.last_name||""),
        ["active","pending-cancel"].includes(String(subscription.status||""))
      ]
    );
  }

  return {localId,relatedOrders:relatedOrders.length,notes:notes.length};
}

async function main(){
  await ensureSchema();
  const checkpoint=await loadCheckpoint();

  const counters=checkpoint.counters||{subscriptionOrderLinks:0,subscriptionNotes:0};
  checkpoint.counters=counters;

  const customers=await processStage(
    checkpoint,"customers","customers",{},
    async(customer)=>importCustomer(customer),
    true
  );

  const orders=await processStage(
    checkpoint,"orders","orders",{status:"any",orderby:"date",order:"asc"},
    async(order)=>importOrder(order)
  );

  const subscriptions=await processStage(
    checkpoint,"subscriptions","subscriptions",{orderby:"date",order:"asc"},
    async(subscription)=>{
      const result=await importSubscription(subscription);
      counters.subscriptionOrderLinks+=result.relatedOrders;
      counters.subscriptionNotes+=result.notes;
      checkpoint.counters=counters;
    },
    true
  );
  if(!subscriptions.available) throw new Error("WooCommerce Subscriptions REST API is not available on the source site.");

  const summary={
    source:base,
    importedAt:new Date().toISOString(),
    pageSize:PAGE_SIZE,
    customers:customers.processed,
    orders:orders.processed,
    subscriptions:subscriptions.processed,
    subscriptionOrderLinks:Number(counters.subscriptionOrderLinks||0),
    subscriptionNotes:Number(counters.subscriptionNotes||0),
    checkpoint:CHECKPOINT_PATH
  };
  await fs.mkdir(path.resolve("data"),{recursive:true});
  await fs.writeFile(path.resolve("data/woo-history-summary.json"),JSON.stringify(summary,null,2));
  checkpoint.completedAt=summary.importedAt;
  await saveCheckpoint(checkpoint);

  console.log("\nWoo history import complete");
  console.log(JSON.stringify(summary,null,2));
}

try{
  await main();
}finally{
  await pool.end();
}
