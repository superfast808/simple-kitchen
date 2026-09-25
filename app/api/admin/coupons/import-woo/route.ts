import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { listCoupons,upsertCoupon } from "@/lib/coupons";

async function wooCoupons(){
  const base=(process.env.WOO_SOURCE_URL||"https://simplekitchenprep.com").replace(/\/$/,"");
  const key=process.env.WOO_CONSUMER_KEY||"";
  const secret=process.env.WOO_CONSUMER_SECRET||"";
  if(!key||!secret) throw new Error("Woo migration credentials are not configured.");
  const authorization="Basic "+Buffer.from(key+":"+secret).toString("base64");
  const rows:any[]=[];
  for(let page=1;;page++){
    const url=new URL(base+"/wp-json/wc/v3/coupons");
    url.searchParams.set("context","edit");url.searchParams.set("per_page","100");url.searchParams.set("page",String(page));
    const response=await fetch(url,{headers:{authorization,accept:"application/json","user-agent":"Simple-Kitchen-Admin-Migration/1.0"}});
    if(!response.ok) throw new Error("Woo coupon import failed: "+response.status+" "+response.statusText);
    const batch=await response.json();
    if(!Array.isArray(batch)) throw new Error("Unexpected Woo coupon response.");
    rows.push(...batch);
    if(batch.length<100) break;
  }
  return rows;
}

function pence(value:unknown){
  const parsed=Number(value);
  return Number.isFinite(parsed)?Math.max(0,Math.round(parsed*100)):0;
}
function nullablePositive(value:unknown){
  const parsed=Number(value);
  return Number.isFinite(parsed)&&parsed>0?Math.round(parsed):null;
}

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const rows=await wooCoupons();
    let imported=0;
    for(const coupon of rows){
      const type=["percent","fixed_cart","fixed_product"].includes(coupon.discount_type)?coupon.discount_type:"fixed_cart";
      await upsertCoupon({
        wooId:Number(coupon.id),
        code:String(coupon.code||"").toUpperCase(),
        description:String(coupon.description||""),
        discountType:type,
        amount:Math.max(0,Number(coupon.amount)||0),
        enabled:String(coupon.status||"publish")==="publish",
        expiryAt:coupon.date_expires_gmt?String(coupon.date_expires_gmt)+"Z":coupon.date_expires?String(coupon.date_expires):null,
        minimumAmountPence:pence(coupon.minimum_amount),
        maximumAmountPence:coupon.maximum_amount? pence(coupon.maximum_amount):null,
        usageLimit:nullablePositive(coupon.usage_limit),
        usageLimitPerCustomer:nullablePositive(coupon.usage_limit_per_user),
        limitUsageToXItems:nullablePositive(coupon.limit_usage_to_x_items),
        individualUse:Boolean(coupon.individual_use),
        freeShipping:Boolean(coupon.free_shipping),
        productIds:(coupon.product_ids||[]).map(String),
        excludedProductIds:(coupon.excluded_product_ids||[]).map(String),
        categories:(coupon.product_categories||[]).map(String),
        excludedCategories:(coupon.excluded_product_categories||[]).map(String),
        excludeSaleItems:Boolean(coupon.exclude_sale_items),
        allowedEmails:(coupon.email_restrictions||[]).map(String),
        legacyUsageCount:Math.max(0,Number(coupon.usage_count)||0),
        legacyUsedBy:(coupon.used_by||[]).map(String),
        source:"woo"
      });
      imported++;
    }
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"coupon.woo_sync",entityType:"coupon",detail:{imported},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true,imported,coupons:await listCoupons()});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to import Woo coupons."},{status:500});
  }
}
