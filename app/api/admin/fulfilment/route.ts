import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { setAdminSetting } from "@/lib/adminSettings";

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin","operator"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await request.json() as Record<string,unknown>;
  const positiveInt=(key:string,min=0)=>{
    const value=Number(body[key]);
    if(!Number.isFinite(value)||value<min) throw new Error(key+" is invalid.");
    return Math.round(value);
  };
  try{
    const zones=Array.isArray(body.deliveryZones)?body.deliveryZones:[];
    const cleanedZones=zones.map((raw,index)=>{
      const zone=(raw||{}) as Record<string,unknown>;
      return {
        id:String(zone.id||"zone-"+(index+1)).slice(0,80),
        name:String(zone.name||"Delivery area").slice(0,120),
        prefixes:Array.isArray(zone.prefixes)?zone.prefixes.map((value)=>String(value).toUpperCase().replace(/\s+/g,"").slice(0,8)).filter(Boolean).slice(0,100):[],
        feePence:Math.max(0,Math.round(Number(zone.feePence)||0)),
        minimumPence:Math.max(0,Math.round(Number(zone.minimumPence)||0)),
        enabled:zone.enabled!==false
      };
    });
    const entries:[string,unknown][]=[
      ["weekly_item_cap",positiveInt("weeklyItemCap",1)],
      ["delivery_slot_cap",positiveInt("deliverySlotCap",0)],
      ["delivery_fee_pence",positiveInt("deliveryFeePence",0)],
      ["minimum_order_pence",positiveInt("minimumOrderPence",0)],
      ["delivery_enabled",body.deliveryEnabled===true],
      ["collection_enabled",body.collectionEnabled===true],
      ["delivery_require_zone_match",body.deliveryRequireZoneMatch===true],
      ["delivery_zones",cleanedZones]
    ];
    await Promise.all(entries.map(([key,value])=>setAdminSetting(key,value,session.userId)));
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"fulfilment.update",entityType:"settings",detail:{zones:cleanedZones.length},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to save fulfilment settings."},{status:400});
  }
}
