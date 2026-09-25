import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { getAdminSetting,setAdminSetting } from "@/lib/adminSettings";
import { getRuntimeSubscriptionPlans } from "@/lib/runtimeSubscriptions";

async function wooGet(endpoint:string){
  const base=(process.env.WOO_SOURCE_URL||"https://simplekitchenprep.com").replace(/\/$/,"");
  const key=process.env.WOO_CONSUMER_KEY||"";
  const secret=process.env.WOO_CONSUMER_SECRET||"";
  if(!key||!secret) throw new Error("Woo migration credentials are not configured.");
  const authorization="Basic "+Buffer.from(key+":"+secret).toString("base64");
  const response=await fetch(base+"/wp-json/wc/v3/"+endpoint.replace(/^\//,""),{
    headers:{authorization,accept:"application/json","user-agent":"Simple-Kitchen-Subscription-Sync/1.0"}
  });
  if(!response.ok) throw new Error("Woo subscription sync failed: "+response.status+" "+response.statusText);
  return response.json();
}

function mealQuantity(variation:any){
  const attr=(variation.attributes||[]).find((item:any)=>String(item?.name||item?.slug||"").toLowerCase().includes("meal"));
  const value=Number(attr?.option||variation.name);
  return Number.isFinite(value)&&value>0?Math.round(value):0;
}
function subscriptionPrice(variation:any){
  const meta=(variation.meta_data||[]).find((entry:any)=>entry.key==="_subscription_price");
  const value=Number(meta?.value??variation.price??variation.regular_price);
  return Number.isFinite(value)?Math.round(value*100):0;
}

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const runtime=await getRuntimeSubscriptionPlans();
    const current=await getAdminSetting<Record<string,any>>("subscription_plan_overrides",{});
    const next={...current};

    for(const plan of Object.values(runtime)){
      if(!plan.wooProductId) continue;
      const parent=await wooGet("products/"+plan.wooProductId+"?context=edit");
      const variations=await wooGet("products/"+plan.wooProductId+"/variations?context=edit&per_page=100");
      const options=(Array.isArray(variations)?variations:[]).map((variation:any)=>({
        meals:mealQuantity(variation),
        pricePence:subscriptionPrice(variation),
        wooVariationId:Number(variation.id)||0,
        enabled:String(variation.status||"publish")==="publish"&&variation.purchasable!==false
      })).filter((item:any)=>item.meals>0).sort((a:any,b:any)=>a.meals-b.meals);

      next[plan.id]={
        ...(next[plan.id]||{}),
        name:String(parent.name||plan.name),
        description:String(parent.short_description||parent.description||plan.description).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(),
        wooProductId:Number(parent.id)||plan.wooProductId,
        intervalWeeks:plan.intervalWeeks,
        fulfilmentsPerCycle:plan.fulfilmentsPerCycle,
        options:options.length?options:plan.options
      };
    }

    await setAdminSetting("subscription_plan_overrides",next,session.userId);
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"subscription_plan.woo_sync",entityType:"subscription_plan",detail:{plans:Object.keys(next).length},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true,plans:Object.values(await getRuntimeSubscriptionPlans())});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to sync Woo subscriptions."},{status:500});
  }
}
