import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { sendMail } from "@/lib/mail";

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const sent=await sendMail(session.email,"Simple Kitchen admin test email","<h2>Simple Kitchen email is working</h2><p>This message was sent from the Operations Console.</p>");
    if(!sent) return NextResponse.json({error:"SMTP is not configured."},{status:503});
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"smtp.test",entityType:"messaging",ipAddress:requestIp(request)});
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Test email failed."},{status:500});
  }
}
