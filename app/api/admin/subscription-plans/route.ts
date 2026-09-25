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
    const pricesRaw=(body.prices||{}) as Record<string,unknown>;
    const prices:Record<string,number>={};
    for(const [meal,value] of Object.entries(pricesRaw)){
      const meals=Number(meal);
      const price=Number(value);
      if(!Number.isInteger(meals)||meals<3||meals>30||!Number.isFinite(price)||price<0) continue;
      prices[String(meals)]=Math.round(price);
    }
    const overrides=await getAdminSetting<Record<string,unknown>>("subscription_plan_overrides",{});
    const next={
      ...overrides,
      [id]:{
        enabled:body.enabled!==false,
        public:body.public===true,
        name:String(body.name||"").trim().slice(0,120),
        description:String(body.description||"").trim().slice(0,300),
        prices
      }
    };
    await setAdminSetting("subscription_plan_overrides",next,session.userId);
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"subscription_plan.update",entityType:"subscription_plan",entityId:id,detail:{enabled:body.enabled!==false,public:body.public===true,pricePoints:Object.keys(prices).length},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to save subscription plan."},{status:400});
  }
}
