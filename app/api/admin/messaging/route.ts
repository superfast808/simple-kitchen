import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { getAdminSecret,setAdminSecret,setAdminSetting } from "@/lib/adminSettings";

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const regular:[string,unknown][]=[
      ["sms_enabled",body.smsEnabled===true],["sms_lookback_days",Math.max(1,Math.min(365,Number(body.smsLookbackDays)||90))],
      ["sms_message",String(body.smsMessage||"")],["sms_day",Math.max(1,Math.min(7,Number(body.smsDay)||1))],
      ["sms_hour",Math.max(0,Math.min(23,Number(body.smsHour)||0))],["sms_minute",Math.max(0,Math.min(59,Number(body.smsMinute)||0))],
      ["clicksend_username",String(body.clicksendUsername||"")],["clicksend_from",String(body.clicksendFrom||"")],
      ["smtp_host",String(body.smtpHost||"")],["smtp_port",Math.max(1,Number(body.smtpPort)||587)],
      ["smtp_secure",body.smtpSecure===true],["smtp_user",String(body.smtpUser||"")],["smtp_from",String(body.smtpFrom||"")]
    ];
    await Promise.all(regular.map(([key,value])=>setAdminSetting(key,value,session.userId)));
    if(String(body.clicksendApiKey||"")) await setAdminSecret("clicksend_api_key",String(body.clicksendApiKey),session.userId);
    if(String(body.smtpPass||"")) await setAdminSecret("smtp_pass",String(body.smtpPass),session.userId);
    const [clicksendKey,smtpPass]=await Promise.all([
      getAdminSecret("clicksend_api_key",process.env.CLICKSEND_API_KEY||""),
      getAdminSecret("smtp_pass",process.env.SMTP_PASS||"")
    ]);
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"messaging.update",entityType:"settings",ipAddress:requestIp(request)});
    return NextResponse.json({ok:true,clicksendConfigured:Boolean(body.clicksendUsername&&clicksendKey),smtpConfigured:Boolean(body.smtpHost&&body.smtpUser&&smtpPass)});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to save messaging settings."},{status:400});
  }
}
