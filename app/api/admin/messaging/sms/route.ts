import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { runSmsReminders } from "@/lib/smsReminders";

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin","operator"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await request.json() as {action?:string};
  try{
    if(body.action==="preview") return NextResponse.json(await runSmsReminders({dryRun:true}));
    if(body.action==="send"){
      const result=await runSmsReminders({force:true});
      await auditAdmin({userId:session.userId,actorEmail:session.email,action:"sms.send_manual",entityType:"messaging",detail:result,ipAddress:requestIp(request)});
      return NextResponse.json(result);
    }
    return NextResponse.json({error:"Unknown action."},{status:400});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"SMS action failed."},{status:500});
  }
}
