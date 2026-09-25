import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { setAdminSetting } from "@/lib/adminSettings";
import { heroDefaults,type HeroKey,type HeroConfig } from "@/lib/pageContent";

const KEYS=Object.keys(heroDefaults) as HeroKey[];

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin","operator"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const body=await request.json() as {heroes?:Record<string,Partial<HeroConfig>>};
    const cleaned:Partial<Record<HeroKey,HeroConfig>>={};
    for(const key of KEYS){
      const source=body.heroes?.[key]||{};
      const overlay=Math.min(.85,Math.max(0,Number(source.overlay??heroDefaults[key].overlay)));
      cleaned[key]={
        eyebrow:String(source.eyebrow??heroDefaults[key].eyebrow).slice(0,100),
        title:String(source.title??heroDefaults[key].title).slice(0,180),
        copy:String(source.copy??heroDefaults[key].copy).slice(0,700),
        background:String(source.background??heroDefaults[key].background).slice(0,1000),
        overlay,
        position:String(source.position??heroDefaults[key].position).slice(0,80),
        primaryLabel:key==="home"?String(source.primaryLabel??(heroDefaults.home.primaryLabel||"")).slice(0,80):undefined,
        primaryHref:key==="home"?String(source.primaryHref??(heroDefaults.home.primaryHref||"")).slice(0,300):undefined,
        secondaryLabel:key==="home"?String(source.secondaryLabel??(heroDefaults.home.secondaryLabel||"")).slice(0,80):undefined,
        secondaryHref:key==="home"?String(source.secondaryHref??(heroDefaults.home.secondaryHref||"")).slice(0,300):undefined
      };
    }
    await setAdminSetting("page_heroes",cleaned,session.userId);
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"content.heroes_update",entityType:"content",detail:{pages:KEYS.length},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to save hero content."},{status:400});
  }
}
