import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { getAdminSetting,setAdminSetting } from "@/lib/adminSettings";

const ids=new Set(["weekly","fortnightly","twice-weekly"]);

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const id=String(body.id||"");
    if(!ids.has(id)) throw new Error("Invalid subscription plan.");

    const rawOptions=Array.isArray(body.options)?body.options:[];
    const seen=new Set<number>();
    const options=rawOptions.map((raw)=>{
      const item=(raw||{}) as Record<string,unknown>;
      const meals=Math.max(1,Math.min(60,Math.round(Number(item.meals)||0)));
      const pricePence=Math.max(0,Math.round(Number(item.pricePence)||0));
      const wooVariationId=Math.max(0,Math.round(Number(item.wooVariationId)||0));
      if(seen.has(meals)) throw new Error("Meal quantities must be unique within a plan.");
      seen.add(meals);
      return {meals,pricePence,wooVariationId,enabled:item.enabled!==false};
    }).sort((a,b)=>a.meals-b.meals);
    if(!options.length) throw new Error("At least one subscription variation is required.");

    const intervalWeeks=Number(body.intervalWeeks)===2?2:1;
    const fulfilmentsPerCycle=Number(body.fulfilmentsPerCycle)===2?2:1;
    const wooProductId=Math.max(0,Math.round(Number(body.wooProductId)||0));

    const overrides=await getAdminSetting<Record<string,unknown>>("subscription_plan_overrides",{});
    const next={
      ...overrides,
      [id]:{
        enabled:body.enabled!==false,
        public:body.public===true,
        name:String(body.name||"").trim().slice(0,120)||id,
        description:String(body.description||"").trim().slice(0,500),
        intervalWeeks,fulfilmentsPerCycle,wooProductId,options
      }
    };
    await setAdminSetting("subscription_plan_overrides",next,session.userId);
    await auditAdmin({
      userId:session.userId,actorEmail:session.email,action:"subscription_plan.update",
      entityType:"subscription_plan",entityId:id,
      detail:{enabled:body.enabled!==false,public:body.public===true,variations:options.length,intervalWeeks,fulfilmentsPerCycle,wooProductId},
      ipAddress:requestIp(request)
    });
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to save subscription plan."},{status:400});
  }
}
