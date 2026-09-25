import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { db } from "@/lib/db";

const allowed=new Set(["pending","paid","processing","completed","on_hold","failed","cancelled","expired"]);

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin","operator"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  const body=await request.json() as {status?:string};
  if(!body.status||!allowed.has(body.status)) return NextResponse.json({error:"Invalid order status."},{status:400});
  const result=await db().query("UPDATE orders SET status=$2,updated_at=now() WHERE id=$1 RETURNING id,status",[id,body.status]);
  if(!result.rowCount) return NextResponse.json({error:"Order not found."},{status:404});
  await auditAdmin({userId:session.userId,actorEmail:session.email,action:"order.status",entityType:"order",entityId:id,detail:{status:body.status},ipAddress:requestIp(request)});
  return NextResponse.json({ok:true,status:body.status});
}
