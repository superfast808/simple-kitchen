// WooCommerce REST API (wc/v3) compatible endpoints used by simplekitchen-admin.
// Only the calls the kitchen system actually makes are implemented:
//   GET  orders, orders/{id}, orders/{id}/refunds
//   POST orders/{id}/refunds        (Stripe refund, like Woo's api_refund)
//   PUT  orders/{id}                (status changes, e.g. cancel)
//   GET  products, products/{id}, products/{id}/variations
//   GET  system_status              (connection test)

import crypto from "node:crypto";
import { DateTime } from "luxon";
import { config } from "./config";
import { db,transaction } from "./db";
import {
  ensureBridgeSchema,loadOrderByNumber,loadOrders,localStatusFromWoo,money,notifyKitchenLater,
  numericProductIds,parseWooDate,refundedPence,statusSql
} from "./kitchenBridge";
import { getRuntimeProductsForFeed } from "./runtimeCatalog";
import { getRuntimeSubscriptionPlans } from "./runtimeSubscriptions";
import { getStripe } from "./stripe";
import type { Product } from "./types";

export class WooError extends Error{
  constructor(public code:string,message:string,public status=400){super(message);}
}

export function wooErrorBody(error:WooError){
  return {code:error.code,message:error.message,data:{status:error.status}};
}

// ── Authentication ─────────────────────────────────────────────────────────

function safeEqual(a:string,b:string){
  const left=Buffer.from(a);
  const right=Buffer.from(b);
  return left.length===right.length&&crypto.timingSafeEqual(left,right);
}

export function authenticate(request:Request){
  const key=process.env.KITCHEN_API_KEY||"";
  const secret=process.env.KITCHEN_API_SECRET||"";
  if(key.length<16||secret.length<16){
    throw new WooError("woocommerce_rest_cannot_view","The kitchen API is not configured on this site.",503);
  }
  let suppliedKey="";
  let suppliedSecret="";
  const header=request.headers.get("authorization")||"";
  if(/^basic /i.test(header)){
    const decoded=Buffer.from(header.slice(6).trim(),"base64").toString("utf8");
    const index=decoded.indexOf(":");
    suppliedKey=index>=0?decoded.slice(0,index):"";
    suppliedSecret=index>=0?decoded.slice(index+1):"";
  }else{
    const url=new URL(request.url);
    suppliedKey=url.searchParams.get("consumer_key")||"";
    suppliedSecret=url.searchParams.get("consumer_secret")||"";
  }
  if(!safeEqual(suppliedKey,key)||!safeEqual(suppliedSecret,secret)){
    throw new WooError("woocommerce_rest_authentication_error","Invalid signature - provided signature does not match.",401);
  }
}

// ── Orders ─────────────────────────────────────────────────────────────────

function pageParams(params:URLSearchParams){
  const perPage=Math.max(1,Math.min(100,Number.parseInt(params.get("per_page")||"10",10)||10));
  const page=Math.max(1,Number.parseInt(params.get("page")||"1",10)||1);
  return {perPage,page,offset:(page-1)*perPage};
}

export async function listOrders(params:URLSearchParams){
  await ensureBridgeSchema();
  const where:string[]=["o.order_number IS NOT NULL"];
  const values:unknown[]=[];
  const add=(value:unknown)=>{values.push(value);return "$"+values.length;};

  const statuses=(params.get("status")||"any").split(",").map((value)=>value.trim().toLowerCase()).filter(Boolean);
  if(!statuses.includes("any")){
    const clauses=statuses.map(statusSql).filter(Boolean);
    if(!clauses.length) return {orders:[],total:0};
    where.push("("+clauses.join(" OR ")+")");
  }else{
    where.push("o.status<>'trash'");
  }
  const after=parseWooDate(params.get("after"));
  if(after) where.push("o.created_at>"+add(after));
  const before=parseWooDate(params.get("before"));
  if(before) where.push("o.created_at<"+add(before));
  const modifiedAfter=parseWooDate(params.get("modified_after"));
  if(modifiedAfter) where.push("o.updated_at>"+add(modifiedAfter));
  const include=(params.get("include")||"").split(",").map((value)=>Number(value)).filter((value)=>Number.isSafeInteger(value)&&value>0);
  if(include.length) where.push("o.order_number=ANY("+add(include)+"::bigint[])");
  const search=(params.get("search")||"").trim();
  if(search) where.push("(o.customer->>'email' ILIKE "+add("%"+search+"%")+" OR o.customer->>'name' ILIKE $"+values.length+")");

  const direction=String(params.get("order")||"desc").toLowerCase()==="asc"?"ASC":"DESC";
  const orderBy=params.get("orderby")==="id"?"o.order_number "+direction:"o.created_at "+direction+",o.order_number "+direction;
  const {perPage,offset}=pageParams(params);
  const count=await db().query("SELECT COUNT(*)::int AS total FROM orders o WHERE "+where.join(" AND "),values);
  const orders=await loadOrders(where.join(" AND "),values,"ORDER BY "+orderBy+" LIMIT "+perPage+" OFFSET "+offset);
  return {orders,total:Number(count.rows[0]?.total||0)};
}

async function orderRow(orderNumber:number){
  await ensureBridgeSchema();
  const result=await db().query("SELECT * FROM orders WHERE order_number=$1",[orderNumber]);
  if(!result.rows[0]) throw new WooError("woocommerce_rest_shop_order_invalid_id","Invalid ID.",404);
  return result.rows[0];
}

export async function getOrder(orderNumber:number){
  const order=await loadOrderByNumber(orderNumber);
  if(!order) throw new WooError("woocommerce_rest_shop_order_invalid_id","Invalid ID.",404);
  return order;
}

export async function updateOrder(orderNumber:number,body:Record<string,unknown>){
  const row=await orderRow(orderNumber);
  const sets:string[]=[];
  const values:unknown[]=[row.id];
  if(body.status!==undefined){
    const status=localStatusFromWoo(String(body.status));
    if(!status) throw new WooError("rest_invalid_param","Invalid parameter(s): status",400);
    values.push(status);
    sets.push("status=$"+values.length);
    if(status==="completed") sets.push("date_completed=COALESCE(date_completed,now())");
  }
  if(typeof body.customer_note==="string"){
    values.push(JSON.stringify({customer_note:body.customer_note.slice(0,2000)}));
    sets.push("source_meta=COALESCE(source_meta,'{}'::jsonb)||$"+values.length+"::jsonb");
  }
  if(sets.length){
    await db().query("UPDATE orders SET "+sets.join(",")+",updated_at=now() WHERE id=$1",values);
    notifyKitchenLater(row.id,"order.updated");
  }
  return getOrder(orderNumber);
}

// ── Refunds ────────────────────────────────────────────────────────────────

function wooRefund(refund:Record<string,any>){
  const created=DateTime.fromJSDate(new Date(refund.created_at));
  return {
    id:Number(refund.id),
    date_created:created.setZone("Europe/London").toFormat("yyyy-LL-dd'T'HH:mm:ss"),
    date_created_gmt:created.toUTC().toFormat("yyyy-LL-dd'T'HH:mm:ss"),
    amount:money(refund.amount_pence),
    reason:String(refund.reason||""),
    refunded_by:0,
    refunded_payment:Boolean(refund.refunded_payment),
    meta_data:[],
    line_items:[]
  };
}

function importedRefundObjects(row:Record<string,any>){
  const list=Array.isArray(row.source_meta?.refunds)?row.source_meta.refunds:[];
  return list.map((refund:any)=>({
    id:Number(refund.id)||0,date_created:null,date_created_gmt:null,
    amount:Math.abs(Number(refund.total)||0).toFixed(2),reason:String(refund.reason||""),
    refunded_by:0,refunded_payment:true,meta_data:[],line_items:[]
  }));
}

export async function listRefunds(orderNumber:number){
  const row=await orderRow(orderNumber);
  const refunds=await db().query("SELECT * FROM order_refunds WHERE order_id=$1 ORDER BY id DESC",[row.id]);
  return [...refunds.rows.map(wooRefund),...importedRefundObjects(row)];
}

/** The Stripe payment behind an order, for refunds. */
async function paymentReference(row:Record<string,any>):Promise<{payment_intent?:string;charge?:string}|null>{
  if(row.stripe_payment_intent_id) return {payment_intent:String(row.stripe_payment_intent_id)};
  if(row.stripe_session_id){
    const stripe=await getStripe();
    const session=await stripe.checkout.sessions.retrieve(String(row.stripe_session_id));
    const intent=typeof session.payment_intent==="string"?session.payment_intent:session.payment_intent?.id;
    if(intent){
      await db().query("UPDATE orders SET stripe_payment_intent_id=$2 WHERE id=$1",[row.id,intent]);
      return {payment_intent:intent};
    }
  }
  // Imported WooCommerce orders paid through the Woo Stripe gateway.
  const meta=Array.isArray(row.source_meta?.meta_data)?row.source_meta.meta_data:[];
  const candidates=[
    row.source_meta?.transaction_id,
    ...meta.filter((entry:any)=>["_stripe_intent_id","_payment_intent_id","_transaction_id"].includes(String(entry?.key))).map((entry:any)=>entry.value)
  ].map((value)=>String(value||"").trim()).filter(Boolean);
  const intent=candidates.find((value)=>value.startsWith("pi_"));
  if(intent) return {payment_intent:intent};
  const charge=candidates.find((value)=>value.startsWith("ch_")||value.startsWith("py_"));
  if(charge) return {charge};
  return null;
}

export async function createRefund(orderNumber:number,body:Record<string,unknown>){
  await ensureBridgeSchema();
  const amountPence=Math.round((Number(body.amount)||0)*100);
  if(amountPence<=0) throw new WooError("woocommerce_rest_invalid_refund_amount","Refund amount must be greater than zero.",400);
  const reason=String(body.reason||"").slice(0,500);
  const apiRefund=body.api_refund!==false&&body.api_refund!=="false";

  const result=await transaction(async(client)=>{
    const found=await client.query("SELECT * FROM orders WHERE order_number=$1 FOR UPDATE",[orderNumber]);
    const row=found.rows[0];
    if(!row) throw new WooError("woocommerce_rest_shop_order_invalid_id","Invalid ID.",404);
    if(!["paid","processing","completed","on_hold"].includes(String(row.status))){
      throw new WooError("woocommerce_rest_cannot_create_order_refund","This order is not in a refundable state.",400);
    }
    const existing=await client.query("SELECT * FROM order_refunds WHERE order_id=$1",[row.id]);
    const remaining=Number(row.total_pence||0)-refundedPence(row,existing.rows);
    if(amountPence>remaining){
      throw new WooError("woocommerce_rest_cannot_create_order_refund","Invalid refund amount.",400);
    }

    let stripeRefundId:string|null=null;
    if(apiRefund){
      if(row.source==="stripe_subscription"){
        throw new WooError("woocommerce_rest_cannot_create_order_refund","Subscription payments must be refunded from the Stripe dashboard.",400);
      }
      const reference=await paymentReference(row);
      if(!reference) throw new WooError("woocommerce_rest_cannot_create_order_refund","No Stripe payment is recorded for this order, so it cannot be refunded automatically.",400);
      const stripe=await getStripe();
      const refund=await stripe.refunds.create({
        ...reference,
        amount:amountPence,
        reason:"requested_by_customer",
        metadata:{orderNumber:String(orderNumber),reason:reason.slice(0,450)}
      },{idempotencyKey:"sk-refund-"+orderNumber+"-"+existing.rows.length+"-"+amountPence});
      stripeRefundId=refund.id;
    }

    const inserted=await client.query(
      `INSERT INTO order_refunds (order_id,amount_pence,reason,stripe_refund_id,refunded_payment,created_by)
       VALUES ($1,$2,$3,$4,$5,'kitchen-api')
       ON CONFLICT (stripe_refund_id) DO UPDATE SET reason=EXCLUDED.reason
       RETURNING *`,
      [row.id,amountPence,reason,stripeRefundId,Boolean(stripeRefundId)]
    );
    if(amountPence>=remaining){
      await client.query("UPDATE orders SET status='refunded',updated_at=now() WHERE id=$1",[row.id]);
    }else{
      await client.query("UPDATE orders SET updated_at=now() WHERE id=$1",[row.id]);
    }
    return {refund:inserted.rows[0],orderId:String(row.id)};
  });
  notifyKitchenLater(result.orderId,"order.updated");
  return wooRefund(result.refund);
}

// ── Products ───────────────────────────────────────────────────────────────

const WEEK_CATEGORY_IDS:Record<number,number>={1:18,2:19,3:28,4:29,5:30,6:31};
const TYPE_CATEGORIES:Record<string,{id:number;name:string;slug:string}>={
  main:{id:15,name:"Meals",slug:"meals"},
  breakfast:{id:16,name:"Breakfast",slug:"breakfast"},
  soup:{id:17,name:"Soups",slug:"soups"},
  treat:{id:20,name:"Sweet Treats",slug:"sweet-treats"},
  special:{id:21,name:"SK Specials",slug:"sk-specials"},
  gift:{id:27,name:"Gift Cards",slug:"gift-cards"}
};

function absoluteUrl(src?:string){
  if(!src) return "";
  return /^https?:\/\//i.test(src)?src:config.siteUrl+(src.startsWith("/")?src:"/"+src);
}

function slugify(value:string){
  return value.toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

function wooProduct(product:Product,enabled:boolean,id:number){
  const weekCategories=product.weeks==="always"?[]:product.weeks.map((week)=>({id:WEEK_CATEGORY_IDS[week]||0,name:"Week "+week,slug:"week-"+week}));
  const type=TYPE_CATEGORIES[product.category];
  const gallery=(product.images?.length?product.images:product.image?[product.image]:[]).map((src,index)=>({id:index+1,src:absoluteUrl(src),name:product.name,alt:product.name}));
  return {
    id,
    name:product.name,
    slug:slugify(product.name),
    permalink:config.siteUrl+"/product/"+product.id,
    type:"simple",
    status:enabled?"publish":"private",
    catalog_visibility:enabled?"visible":"hidden",
    description:product.longDescription||product.description,
    short_description:product.description,
    sku:"",
    price:product.price.toFixed(2),
    regular_price:product.price.toFixed(2),
    sale_price:"",
    purchasable:enabled,
    virtual:product.category==="gift",
    stock_status:"instock",
    categories:[...weekCategories,...(type?[type]:[])],
    images:gallery,
    attributes:[],
    variations:[],
    meta_data:[]
  };
}

async function subscriptionProducts(){
  const plans=Object.values(await getRuntimeSubscriptionPlans());
  return plans.map((plan)=>({
    product:{
      id:plan.wooProductId,
      name:plan.name,
      slug:slugify(plan.name),
      permalink:config.siteUrl+"/subscriptions",
      type:"variable-subscription",
      status:plan.enabled?"publish":"private",
      catalog_visibility:plan.public?"visible":"hidden",
      description:plan.description,
      short_description:plan.description,
      sku:"",
      price:(Math.min(...plan.options.map((option)=>option.pricePence))/100).toFixed(2),
      regular_price:"",
      sale_price:"",
      purchasable:plan.enabled,
      virtual:false,
      stock_status:"instock",
      categories:[{id:26,name:"Subscriptions",slug:"subscriptions"}],
      images:[],
      attributes:[{id:0,name:"Meals",position:0,visible:true,variation:true,options:plan.options.map((option)=>String(option.meals))}],
      variations:plan.options.map((option)=>option.wooVariationId),
      meta_data:[]
    },
    variations:plan.options.map((option)=>({
      id:option.wooVariationId,
      parent_id:plan.wooProductId,
      name:plan.name+" - "+option.meals,
      status:plan.enabled&&option.enabled!==false?"publish":"private",
      price:(option.pricePence/100).toFixed(2),
      regular_price:(option.pricePence/100).toFixed(2),
      sale_price:"",
      purchasable:plan.enabled&&option.enabled!==false,
      stock_status:"instock",
      attributes:[{id:0,name:"Meals",option:String(option.meals)}],
      image:null,
      meta_data:[]
    }))
  }));
}

export async function allWooProducts(){
  const feed=await getRuntimeProductsForFeed();
  const ids=await numericProductIds(feed.map((entry)=>entry.product.id));
  const seen=new Set<number>();
  const products:any[]=[];
  for(const entry of feed){
    const id=ids.get(entry.product.id);
    if(!id||seen.has(id)) continue;
    seen.add(id);
    products.push(wooProduct(entry.product,entry.enabled,id));
  }
  const subscriptions=await subscriptionProducts();
  for(const subscription of subscriptions){
    if(seen.has(subscription.product.id)) continue;
    seen.add(subscription.product.id);
    products.push(subscription.product);
  }
  return {products,subscriptions};
}

export async function listProducts(params:URLSearchParams){
  const {products}=await allWooProducts();
  const status=(params.get("status")||"publish").toLowerCase();
  const filtered=status==="any"?products:products.filter((product)=>product.status===status);
  const include=(params.get("include")||"").split(",").map(Number).filter((value)=>value>0);
  const list=include.length?filtered.filter((product)=>include.includes(product.id)):filtered;
  const {perPage,offset}=pageParams(params);
  return {products:list.slice(offset,offset+perPage),total:list.length};
}

export async function getProduct(id:number){
  const {products}=await allWooProducts();
  const product=products.find((item)=>item.id===id);
  if(!product) throw new WooError("woocommerce_rest_product_invalid_id","Invalid ID.",404);
  return product;
}

export async function listVariations(parentId:number,params:URLSearchParams){
  const {subscriptions}=await allWooProducts();
  const match=subscriptions.find((entry)=>entry.product.id===parentId);
  const list=match?match.variations:[];
  const status=(params.get("status")||"any").toLowerCase();
  const filtered=status==="any"?list:list.filter((variation)=>variation.status===status);
  const {perPage,offset}=pageParams(params);
  return {variations:filtered.slice(offset,offset+perPage),total:filtered.length};
}

export function systemStatus(){
  return {
    environment:{home_url:config.siteUrl,site_url:config.siteUrl,version:"simple-kitchen",wp_version:"n/a",language:"en_GB"},
    settings:{currency:"GBP",currency_symbol:"£"}
  };
}
