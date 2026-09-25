import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,changeAdminPassword,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const body=await request.json() as {currentPassword?:string;newPassword?:string};
    await changeAdminPassword(session.userId,String(body.currentPassword||""),String(body.newPassword||""));
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"admin.password_change",entityType:"admin_user",entityId:session.userId,ipAddress:requestIp(request)});
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to change password."},{status:400});
  }
}
