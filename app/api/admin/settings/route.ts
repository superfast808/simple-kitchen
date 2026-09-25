import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { setAdminSetting } from "@/lib/adminSettings";

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const givingStart=String(body.givingStart||"");
    const givingEnd=String(body.givingEnd||"");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(givingStart)||!/^\d{4}-\d{2}-\d{2}$/.test(givingEnd)) throw new Error("Campaign dates must be valid.");
    await Promise.all([
      setAdminSetting("giving_enabled",body.givingEnabled===true,session.userId),
      setAdminSetting("giving_start",givingStart,session.userId),
      setAdminSetting("giving_end",givingEnd,session.userId)
    ]);
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"settings.update",entityType:"settings",detail:{givingEnabled:body.givingEnabled===true,givingStart,givingEnd},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to save settings."},{status:400});
  }
}
