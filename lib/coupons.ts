import { db } from "./db";
import type { Product } from "./types";

export type CouponRow={
  id:string;
  woo_id:number|null;
  code:string;
  description:string|null;
  discount_type:"percent"|"fixed_cart"|"fixed_product";
  amount:string|number;
  enabled:boolean;
  expiry_at:string|null;
  minimum_amount_pence:number;
  maximum_amount_pence:number|null;
  usage_limit:number|null;
  usage_limit_per_customer:number|null;
  limit_usage_to_x_items:number|null;
  individual_use:boolean;
  free_shipping:boolean;
  product_ids:string[];
  excluded_product_ids:string[];
  categories:string[];
  excluded_categories:string[];
  exclude_sale_items:boolean;
  allowed_emails:string[];
  legacy_usage_count:number;
  legacy_used_by:string[];
  source:string;
};

let schemaReady:Promise<void>|null=null;
export async function ensureCouponSchema(){
  if(!schemaReady){
    schemaReady=(async()=>{
      await db().query(`
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id uuid;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code text;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_pence integer NOT NULL DEFAULT 0;
        CREATE TABLE IF NOT EXISTS coupons (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          woo_id bigint UNIQUE,
          code text NOT NULL,
          description text,
          discount_type text NOT NULL DEFAULT 'fixed_cart',
          amount numeric(12,2) NOT NULL DEFAULT 0,
          enabled boolean NOT NULL DEFAULT true,
          expiry_at timestamptz,
          minimum_amount_pence integer NOT NULL DEFAULT 0,
          maximum_amount_pence integer,
          usage_limit integer,
          usage_limit_per_customer integer,
          limit_usage_to_x_items integer,
          individual_use boolean NOT NULL DEFAULT false,
          free_shipping boolean NOT NULL DEFAULT false,
          product_ids text[] NOT NULL DEFAULT '{}',
          excluded_product_ids text[] NOT NULL DEFAULT '{}',
          categories text[] NOT NULL DEFAULT '{}',
          excluded_categories text[] NOT NULL DEFAULT '{}',
          exclude_sale_items boolean NOT NULL DEFAULT false,
          allowed_emails text[] NOT NULL DEFAULT '{}',
          legacy_usage_count integer NOT NULL DEFAULT 0,
          legacy_used_by text[] NOT NULL DEFAULT '{}',
          source text NOT NULL DEFAULT 'admin',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        ALTER TABLE coupons ADD COLUMN IF NOT EXISTS legacy_usage_count integer NOT NULL DEFAULT 0;
        ALTER TABLE coupons ADD COLUMN IF NOT EXISTS legacy_used_by text[] NOT NULL DEFAULT '{}';
        CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_unique_idx ON coupons (lower(code));
        CREATE TABLE IF NOT EXISTS coupon_redemptions (
          id bigserial PRIMARY KEY,
          coupon_id uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
          order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          customer_email text,
          discount_pence integer NOT NULL DEFAULT 0,
          redeemed_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(coupon_id,order_id)
        );
      `);
    })();
  }
  await schemaReady;
}

function rootProductId(id:string){
  const match=id.match(/^(\d+)/);
  return match?match[1]:id;
}

function wildcardMatch(value:string,pattern:string){
  const val=value.toLowerCase();
  const p=pattern.trim().toLowerCase();
  if(!p) return false;
  if(!p.includes("*")) return val===p;
  const parts=p.split("*");
  let cursor=0;
  for(const part of parts){
    if(!part) continue;
    const index=val.indexOf(part,cursor);
    if(index<0) return false;
    cursor=index+part.length;
  }
  if(!p.startsWith("*")&&parts[0]&&!val.startsWith(parts[0])) return false;
  const last=parts[parts.length-1];
  if(!p.endsWith("*")&&last&&!val.endsWith(last)) return false;
  return true;
}

function wooCategoryIds(product:Product){
  if(product.category==="gift") return ["27"];
  if(product.weeks!=="always"){
    const map:Record<number,string>={1:"18",2:"19",3:"28",4:"29",5:"30",6:"31"};
    return product.weeks.map((week)=>map[week]).filter(Boolean);
  }
  return [];
}

function productEligible(coupon:CouponRow,product:Product){
  if(coupon.source==="gift_card"&&product.category==="gift") return false;
  const id=rootProductId(product.id);
  const categoryIds=wooCategoryIds(product);
  if(coupon.product_ids?.length&&!coupon.product_ids.includes(id)) return false;
  if(coupon.excluded_product_ids?.includes(id)) return false;
  if(coupon.categories?.length&&!coupon.categories.some((id)=>categoryIds.includes(String(id)))) return false;
  if(coupon.excluded_categories?.some((id)=>categoryIds.includes(String(id)))) return false;
  return true;
}

export async function validateCoupon(input:{
  code:string;
  items:{product:Product;quantity:number}[];
  email:string;
  subtotalPence:number;
}){
  await ensureCouponSchema();
  const code=input.code.trim();
  if(!code) return null;

  const result=await db().query("SELECT * FROM coupons WHERE lower(code)=lower($1) LIMIT 1",[code]);
  const coupon=result.rows[0] as CouponRow|undefined;
  if(!coupon||!coupon.enabled) throw new Error("This coupon code is not valid.");
  if(coupon.expiry_at&&new Date(coupon.expiry_at).getTime()<Date.now()) throw new Error("This coupon has expired.");

  if(input.subtotalPence<Number(coupon.minimum_amount_pence||0)){
    throw new Error("This coupon requires a minimum spend of £"+(Number(coupon.minimum_amount_pence)/100).toFixed(2)+".");
  }
  if(coupon.maximum_amount_pence!=null&&input.subtotalPence>Number(coupon.maximum_amount_pence)){
    throw new Error("This coupon is limited to orders up to £"+(Number(coupon.maximum_amount_pence)/100).toFixed(2)+".");
  }

  if(coupon.allowed_emails?.length){
    const email=input.email.trim().toLowerCase();
    if(!coupon.allowed_emails.some((pattern)=>wildcardMatch(email,pattern))){
      throw new Error("This coupon is not available for this email address.");
    }
  }

  if(coupon.usage_limit!=null){
    const usage=await db().query("SELECT COUNT(*)::int AS count FROM coupon_redemptions WHERE coupon_id=$1",[coupon.id]);
    if(Number(coupon.legacy_usage_count||0)+Number(usage.rows[0]?.count||0)>=Number(coupon.usage_limit)) throw new Error("This coupon has reached its usage limit.");
  }
  if(coupon.usage_limit_per_customer!=null&&input.email){
    const usage=await db().query(
      "SELECT COUNT(*)::int AS count FROM coupon_redemptions WHERE coupon_id=$1 AND lower(customer_email)=lower($2)",
      [coupon.id,input.email]
    );
    const legacyMatches=(coupon.legacy_used_by||[]).filter((value)=>String(value).toLowerCase()===input.email.toLowerCase()).length;
    if(legacyMatches+Number(usage.rows[0]?.count||0)>=Number(coupon.usage_limit_per_customer)) throw new Error("You have already used this coupon the maximum number of times.");
  }

  let eligibleUnits=input.items
    .filter((item)=>productEligible(coupon,item.product))
    .flatMap((item)=>Array.from({length:item.quantity},()=>Math.round(item.product.price*100)));

  if(!eligibleUnits.length) throw new Error("This coupon does not apply to the products in your basket.");
  if(coupon.limit_usage_to_x_items!=null&&Number(coupon.limit_usage_to_x_items)>0){
    eligibleUnits=eligibleUnits.slice(0,Number(coupon.limit_usage_to_x_items));
  }

  const eligibleSubtotal=eligibleUnits.reduce((sum,value)=>sum+value,0);
  let amount=Number(coupon.amount||0);
  if(coupon.source==="gift_card"){
    const pending=await db().query(
      `SELECT COALESCE(SUM(discount_pence),0)::int AS reserved
       FROM orders
       WHERE coupon_id=$1 AND status='pending' AND (expires_at IS NULL OR expires_at>now())`,
      [coupon.id]
    );
    amount=Math.max(0,amount-Number(pending.rows[0]?.reserved||0)/100);
    if(amount<=0) throw new Error("This gift card currently has no available balance.");
  }
  let discountPence=0;
  if(coupon.discount_type==="percent"){
    discountPence=Math.round(eligibleSubtotal*Math.max(0,Math.min(100,amount))/100);
  }else if(coupon.discount_type==="fixed_product"){
    discountPence=Math.min(eligibleSubtotal,Math.round(amount*100)*eligibleUnits.length);
  }else{
    discountPence=Math.min(eligibleSubtotal,Math.round(amount*100));
  }

  discountPence=Math.max(0,Math.min(input.subtotalPence,discountPence));
  if(discountPence<=0&&!coupon.free_shipping) throw new Error("This coupon does not reduce the current order.");

  return {
    id:coupon.id,
    code:coupon.code,
    description:coupon.description||"",
    discountPence,
    freeShipping:Boolean(coupon.free_shipping),
    wooId:coupon.woo_id,
    discountType:coupon.discount_type,
    source:coupon.source
  };
}

export async function recordCouponRedemptionBySession(sessionId:string){
  await ensureCouponSchema();
  const result=await db().query(
    "SELECT id,coupon_id,coupon_code,discount_pence,customer FROM orders WHERE stripe_session_id=$1 AND coupon_id IS NOT NULL LIMIT 1",
    [sessionId]
  );
  const order=result.rows[0];
  if(!order) return false;
  const inserted=await db().query(
    `INSERT INTO coupon_redemptions (coupon_id,order_id,customer_email,discount_pence)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (coupon_id,order_id) DO NOTHING
     RETURNING id`,
    [order.coupon_id,order.id,order.customer?.email||"",Number(order.discount_pence||0)]
  );
  if(inserted.rowCount){
    await db().query(
      `UPDATE coupons
       SET amount=CASE WHEN source='gift_card' THEN GREATEST(0,amount-($2::numeric/100)) ELSE amount END,
           enabled=CASE WHEN source='gift_card' AND amount-($2::numeric/100)<=0 THEN false ELSE enabled END,
           updated_at=now()
       WHERE id=$1`,
      [order.coupon_id,Number(order.discount_pence||0)]
    );
  }
  return Boolean(inserted.rowCount);
}

export async function listCoupons(){
  await ensureCouponSchema();
  const result=await db().query(`
    SELECT c.*,
      (c.legacy_usage_count+COUNT(r.id))::int AS redemption_count,
      COALESCE(SUM(r.discount_pence),0)::int AS discount_total_pence,
      MAX(g.delivered_at) AS gift_delivered_at,
      MAX(g.recipient_email) AS gift_recipient_email,
      MAX(g.order_id::text) AS gift_order_id
    FROM coupons c
    LEFT JOIN coupon_redemptions r ON r.coupon_id=c.id
    LEFT JOIN gift_card_issuances g ON g.coupon_id=c.id
    GROUP BY c.id
    ORDER BY c.enabled DESC,c.updated_at DESC,c.code ASC
  `);
  return result.rows;
}

export async function upsertCoupon(input:{
  id?:string;wooId?:number|null;code:string;description?:string;discountType:"percent"|"fixed_cart"|"fixed_product";
  amount:number;enabled:boolean;expiryAt?:string|null;minimumAmountPence:number;maximumAmountPence?:number|null;
  usageLimit?:number|null;usageLimitPerCustomer?:number|null;limitUsageToXItems?:number|null;individualUse:boolean;
  freeShipping:boolean;productIds:string[];excludedProductIds:string[];categories:string[];excludedCategories:string[];
  excludeSaleItems:boolean;allowedEmails:string[];legacyUsageCount?:number;legacyUsedBy?:string[];source?:string;
}){
  await ensureCouponSchema();
  const values=[
    input.wooId??null,input.code.trim(),input.description||"",input.discountType,input.amount,input.enabled,
    input.expiryAt||null,input.minimumAmountPence,input.maximumAmountPence??null,input.usageLimit??null,
    input.usageLimitPerCustomer??null,input.limitUsageToXItems??null,input.individualUse,input.freeShipping,
    input.productIds,input.excludedProductIds,input.categories,input.excludedCategories,input.excludeSaleItems,
    input.allowedEmails,input.legacyUsageCount??0,input.legacyUsedBy||[],input.source||"admin"
  ];

  if(input.id){
    const result=await db().query(`
      UPDATE coupons SET
        woo_id=COALESCE($2,woo_id),code=$3,description=$4,discount_type=$5,amount=$6,enabled=$7,expiry_at=$8,
        minimum_amount_pence=$9,maximum_amount_pence=$10,usage_limit=$11,usage_limit_per_customer=$12,
        limit_usage_to_x_items=$13,individual_use=$14,free_shipping=$15,product_ids=$16,excluded_product_ids=$17,
        categories=$18,excluded_categories=$19,exclude_sale_items=$20,allowed_emails=$21,
        legacy_usage_count=$22,legacy_used_by=$23,source=$24,updated_at=now()
      WHERE id=$1
      RETURNING *`,
      [input.id,...values]
    );
    if(!result.rowCount) throw new Error("Coupon not found.");
    return result.rows[0];
  }

  const result=await db().query(`
    INSERT INTO coupons
      (woo_id,code,description,discount_type,amount,enabled,expiry_at,minimum_amount_pence,maximum_amount_pence,
       usage_limit,usage_limit_per_customer,limit_usage_to_x_items,individual_use,free_shipping,product_ids,
       excluded_product_ids,categories,excluded_categories,exclude_sale_items,allowed_emails,legacy_usage_count,legacy_used_by,source)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
    ON CONFLICT ((lower(code))) DO UPDATE SET
      woo_id=COALESCE(EXCLUDED.woo_id,coupons.woo_id),description=EXCLUDED.description,discount_type=EXCLUDED.discount_type,
      amount=EXCLUDED.amount,enabled=EXCLUDED.enabled,expiry_at=EXCLUDED.expiry_at,minimum_amount_pence=EXCLUDED.minimum_amount_pence,
      maximum_amount_pence=EXCLUDED.maximum_amount_pence,usage_limit=EXCLUDED.usage_limit,
      usage_limit_per_customer=EXCLUDED.usage_limit_per_customer,limit_usage_to_x_items=EXCLUDED.limit_usage_to_x_items,
      individual_use=EXCLUDED.individual_use,free_shipping=EXCLUDED.free_shipping,product_ids=EXCLUDED.product_ids,
      excluded_product_ids=EXCLUDED.excluded_product_ids,categories=EXCLUDED.categories,
      excluded_categories=EXCLUDED.excluded_categories,exclude_sale_items=EXCLUDED.exclude_sale_items,
      allowed_emails=EXCLUDED.allowed_emails,legacy_usage_count=EXCLUDED.legacy_usage_count,
      legacy_used_by=EXCLUDED.legacy_used_by,source=EXCLUDED.source,updated_at=now()
    RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function deleteCoupon(id:string){
  await ensureCouponSchema();
  const coupon=await db().query("SELECT source FROM coupons WHERE id=$1",[id]);
  if(!coupon.rowCount) return "deleted";
  const usage=await db().query("SELECT COUNT(*)::int AS count FROM coupon_redemptions WHERE coupon_id=$1",[id]);
  if(String(coupon.rows[0].source)==="gift_card"||Number(usage.rows[0]?.count||0)>0){
    await db().query("UPDATE coupons SET enabled=false,updated_at=now() WHERE id=$1",[id]);
    return "disabled";
  }
  await db().query("DELETE FROM coupons WHERE id=$1",[id]);
  return "deleted";
}
