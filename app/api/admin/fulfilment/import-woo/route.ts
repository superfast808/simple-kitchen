import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { setAdminSetting } from "@/lib/adminSettings";
import { getRuntimeCommerceSettings } from "@/lib/runtimeConfig";

function moneyPence(value:unknown,fallback:number){
  const parsed=Number(value);
  return Number.isFinite(parsed)?Math.max(0,Math.round(parsed*100)):fallback;
}

async function wooGet(endpoint:string){
  const base=(process.env.WOO_SOURCE_URL||"https://simplekitchenprep.com").replace(/\/$/,"");
  const key=process.env.WOO_CONSUMER_KEY||"";
  const secret=process.env.WOO_CONSUMER_SECRET||"";
  if(!key||!secret) throw new Error("Woo migration credentials are not configured.");
  const authorization="Basic "+Buffer.from(key+":"+secret).toString("base64");
  const response=await fetch(base+"/wp-json/wc/v3/"+endpoint.replace(/^\//,""),{
    headers:{authorization,accept:"application/json","user-agent":"Simple-Kitchen-Admin-Migration/1.0"}
  });
  if(!response.ok) throw new Error("Woo shipping sync failed: "+response.status+" "+response.statusText);
  return response.json();
}

function settingValue(settings:any,key:string){
  const value=settings?.[key];
  if(value==null) return "";
  if(typeof value==="object"&&"value" in value) return value.value;
  return value;
}

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});

  try{
    const runtime=await getRuntimeCommerceSettings();
    const zoneRows=await wooGet("shipping/zones");
    if(!Array.isArray(zoneRows)) throw new Error("Unexpected Woo shipping-zone response.");

    const zones:any[]=[];
    for(const zone of zoneRows){
      if(Number(zone.id)===0) continue;
      const [locations,methods]=await Promise.all([
        wooGet("shipping/zones/"+zone.id+"/locations"),
        wooGet("shipping/zones/"+zone.id+"/methods")
      ]);

      const patterns=(Array.isArray(locations)?locations:[])
        .filter((location:any)=>location?.type==="postcode")
        .map((location:any)=>String(location.code||"").toUpperCase().replace(/\s+/g,""))
        .filter(Boolean);

      const enabledMethods=(Array.isArray(methods)?methods:[]).filter((method:any)=>method?.enabled===true);
      const collectionMethods=enabledMethods.filter((method:any)=>String(method.title||"").toLowerCase().includes("collection"));
      const deliveryMethods=enabledMethods.filter((method:any)=>{
        const title=String(method.title||"").toLowerCase();
        if(title.includes("collection")) return false;
        return title.includes("delivery")||String(method.method_title||"").toLowerCase()==="flat rate";
      });

      const flat=deliveryMethods.find((method:any)=>String(method.method_title||"").toLowerCase()==="flat rate");
      const free=deliveryMethods.find((method:any)=>String(method.method_title||"").toLowerCase()==="free shipping");
      const feePence=flat?moneyPence(settingValue(flat.settings,"cost"),runtime.deliveryFeePence):runtime.deliveryFeePence;

      let freeDeliveryMinimumPence:null|number=null;
      if(free){
        const requires=String(settingValue(free.settings,"requires")||"").toLowerCase();
        const minAmount=settingValue(free.settings,"min_amount");
        if(!requires) freeDeliveryMinimumPence=0;
        else if(["min_amount","either","both"].includes(requires)) freeDeliveryMinimumPence=moneyPence(minAmount,0);
      }

      zones.push({
        id:"woo-"+zone.id,
        name:String(zone.name||"Shipping zone"),
        patterns,
        deliveryEnabled:deliveryMethods.length>0,
        collectionEnabled:collectionMethods.length>0,
        feePence,
        minimumPence:runtime.minimumOrderPence,
        freeDeliveryMinimumPence
      });
    }

    // Woo's "Everywhere" collection zone is intentionally represented as a no-postcode fallback,
    // but the delivery engine never allows fallback delivery for an unmatched postcode.
    await Promise.all([
      setAdminSetting("delivery_zones",zones,session.userId),
      setAdminSetting("delivery_require_zone_match",true,session.userId)
    ]);

    await auditAdmin({
      userId:session.userId,actorEmail:session.email,action:"fulfilment.woo_sync",
      entityType:"shipping_zones",detail:{zones:zones.length},ipAddress:requestIp(request)
    });
    return NextResponse.json({ok:true,zones});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to sync Woo shipping zones."},{status:500});
  }
}
