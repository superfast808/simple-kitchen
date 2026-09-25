import { NextRequest,NextResponse } from "next/server";
import { DateTime } from "luxon";
import { runSmsReminders } from "@/lib/smsReminders";
import { getAdminSetting } from "@/lib/adminSettings";

function authorized(request:NextRequest){
  return Boolean(process.env.CRON_SECRET&&request.headers.get("authorization")==="Bearer "+process.env.CRON_SECRET);
}

async function scheduleDue(){
  const now=DateTime.now().setZone("Europe/London");
  const [dayRaw,hourRaw,minuteRaw]=await Promise.all([
    getAdminSetting("sms_day",Number(process.env.SMS_AUTO_DAY||1)),
    getAdminSetting("sms_hour",Number(process.env.SMS_AUTO_HOUR||10)),
    getAdminSetting("sms_minute",Number(process.env.SMS_AUTO_MINUTE||0))
  ]);
  const day=Math.min(7,Math.max(1,Number(dayRaw)||1));
  const hour=Math.min(23,Math.max(0,Number(hourRaw)||0));
  const minute=Math.min(59,Math.max(0,Number(minuteRaw)||0));
  const targetMinutes=hour*60+minute;
  const nowMinutes=now.hour*60+now.minute;
  return now.weekday===day&&nowMinutes>=targetMinutes&&nowMinutes<targetMinutes+15;
}

export async function GET(request:NextRequest){
  if(!authorized(request)) return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const result=await runSmsReminders({dryRun:true});
    return NextResponse.json(result);
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to preview SMS reminders."},{status:500});
  }
}

export async function POST(request:NextRequest){
  if(!authorized(request)) return NextResponse.json({error:"Unauthorized"},{status:401});
  const force=request.nextUrl.searchParams.get("force")==="1";
  if(!force&&!(await scheduleDue())) return NextResponse.json({ok:true,due:false,sent:0});
  try{
    const result=await runSmsReminders();
    return NextResponse.json({ok:true,due:true,...result});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to send SMS reminders."},{status:500});
  }
}
