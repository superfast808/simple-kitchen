import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { listCoupons,upsertCoupon } from "@/lib/coupons";

const types=new Set(["percent","fixed_cart","fixed_product"]);
const arr=(value:unknown)=>Array.isArray(value)?value.map((item)=>String(item)).filter(Boolean):[];

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin","operator"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const code=String(body.code||"").trim().toUpperCase();
    const source=String(body.source||"admin");
    if(!code) throw new Error("Coupon code is required.");
    if(source==="gift_card"&&body.id) throw new Error("Gift-card balances cannot be edited manually.");
    const type=String(body.discount_type||"percent");
    if(!types.has(type)) throw new Error("Invalid discount type.");

    const coupon=await upsertCoupon({
      id:String(body.id||"")||undefined,
      wooId:body.woo_id==null?null:Number(body.woo_id),
      code,
      description:String(body.description||""),
      discountType:type as "percent"|"fixed_cart"|"fixed_product",
      amount:Math.max(0,Number(body.amount)||0),
      enabled:body.enabled!==false,
      expiryAt:body.expiry_at?String(body.expiry_at):null,
      minimumAmountPence:Math.max(0,Math.round(Number(body.minimum_amount_pence)||0)),
      maximumAmountPence:body.maximum_amount_pence==null?null:Math.max(0,Math.round(Number(body.maximum_amount_pence)||0)),
      usageLimit:body.usage_limit==null?null:Math.max(1,Math.round(Number(body.usage_limit)||1)),
      usageLimitPerCustomer:body.usage_limit_per_customer==null?null:Math.max(1,Math.round(Number(body.usage_limit_per_customer)||1)),
      limitUsageToXItems:body.limit_usage_to_x_items==null?null:Math.max(1,Math.round(Number(body.limit_usage_to_x_items)||1)),
      individualUse:body.individual_use===true,
      freeShipping:body.free_shipping===true,
      productIds:arr(body.product_ids),
      excludedProductIds:arr(body.excluded_product_ids),
      categories:arr(body.categories),
      excludedCategories:arr(body.excluded_categories),
      excludeSaleItems:body.exclude_sale_items===true,
      allowedEmails:arr(body.allowed_emails),
      legacyUsageCount:Math.max(0,Math.round(Number(body.legacy_usage_count)||0)),
      legacyUsedBy:arr(body.legacy_used_by),
      source:source==="woo"?"woo":"admin"
    });
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"coupon.save",entityType:"coupon",entityId:String(coupon.id),detail:{code:coupon.code,source:coupon.source},ipAddress:requestIp(request)});
    const rows=await listCoupons();
    const saved=rows.find((row)=>String(row.id)===String(coupon.id))||coupon;
    return NextResponse.json({ok:true,coupon:saved});
  }catch(error){
    const message=error instanceof Error?error.message:"Unable to save coupon.";
    return NextResponse.json({error:message.includes("duplicate key")?"That coupon code already exists.":message},{status:400});
  }
}
