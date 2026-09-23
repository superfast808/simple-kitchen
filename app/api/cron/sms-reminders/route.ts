import { NextRequest,NextResponse } from "next/server";
import { runSmsReminders } from "@/lib/smsReminders";

function authorized(request:NextRequest){
  return Boolean(process.env.CRON_SECRET&&request.headers.get("authorization")==="Bearer "+process.env.CRON_SECRET);
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
  try{
    const result=await runSmsReminders();
    return NextResponse.json(result);
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to send SMS reminders."},{status:500});
  }
}
