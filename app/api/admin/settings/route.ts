import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { getAdminSecret,setAdminSecret,setAdminSetting } from "@/lib/adminSettings";

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const datePattern=/^\d{4}-\d{2}-\d{2}$/;
    const cycleStartDate=String(body.cycleStartDate||"");
    const givingStart=String(body.givingStart||"");
    const givingEnd=String(body.givingEnd||"");
    const force=String(body.menuForceState||"auto");
    if(!datePattern.test(cycleStartDate)||!datePattern.test(givingStart)||!datePattern.test(givingEnd)) throw new Error("Dates must be valid ISO dates.");
    if(!["auto","open","closed"].includes(force)) throw new Error("Invalid menu state.");

    await Promise.all([
      setAdminSetting("cycle_start_date",cycleStartDate,session.userId),
      setAdminSetting("menu_force_state",force,session.userId),
      setAdminSetting("giving_enabled",body.givingEnabled===true,session.userId),
      setAdminSetting("giving_start",givingStart,session.userId),
      setAdminSetting("giving_end",givingEnd,session.userId)
    ]);
    if(String(body.stripeSecret||"")) await setAdminSecret("stripe_secret_key",String(body.stripeSecret),session.userId);
    if(String(body.stripeWebhookSecret||"")) await setAdminSecret("stripe_webhook_secret",String(body.stripeWebhookSecret),session.userId);
    const [stripeKey,webhookSecret]=await Promise.all([
      getAdminSecret("stripe_secret_key",process.env.STRIPE_SECRET_KEY||""),
      getAdminSecret("stripe_webhook_secret",process.env.STRIPE_WEBHOOK_SECRET||"")
    ]);
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"settings.update",entityType:"settings",detail:{cycleStartDate,menuForceState:force,givingEnabled:body.givingEnabled===true},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true,stripeConfigured:Boolean(stripeKey),stripeWebhookConfigured:Boolean(webhookSecret)});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to save settings."},{status:400});
  }
}
