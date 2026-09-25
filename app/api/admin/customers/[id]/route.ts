import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { ensureCustomerSchema } from "@/lib/customerAuth";
import { db } from "@/lib/db";

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  try{
    const body=await request.json() as {enabled?:boolean};
    if(typeof body.enabled!=="boolean") throw new Error("Enabled state is required.");
    await ensureCustomerSchema();
    const result=await db().query("UPDATE customer_users SET enabled=$2,updated_at=now() WHERE id=$1 RETURNING id,email,enabled",[id,body.enabled]);
    if(!result.rowCount) return NextResponse.json({error:"Customer not found."},{status:404});
    if(!body.enabled) await db().query("DELETE FROM customer_sessions WHERE user_id=$1",[id]);
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"customer.access_update",entityType:"customer",entityId:id,detail:{enabled:body.enabled},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to update customer."},{status:400});
  }
}
