import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { db } from "@/lib/db";

const roles=new Set(["viewer","operator","admin","owner"]);

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner"]);
  if(!session) return NextResponse.json({error:"Owner access required."},{status:403});
  const {id}=await params;
  if(id===session.userId) return NextResponse.json({error:"Use your own security controls for your account."},{status:400});
  const body=await request.json() as {enabled?:boolean;role?:string};
  if(body.role!==undefined&&!roles.has(String(body.role))) return NextResponse.json({error:"Invalid role."},{status:400});
  const result=await db().query(
    "UPDATE admin_users SET enabled=COALESCE($2,enabled),role=COALESCE($3,role),updated_at=now() WHERE id=$1 RETURNING id,email,role,enabled",
    [id,typeof body.enabled==="boolean"?body.enabled:null,body.role!==undefined?String(body.role):null]
  );
  if(!result.rowCount) return NextResponse.json({error:"Admin user not found."},{status:404});
  if(body.enabled===false) await db().query("DELETE FROM admin_sessions WHERE user_id=$1",[id]);
  await auditAdmin({userId:session.userId,actorEmail:session.email,action:"admin_user.update",entityType:"admin_user",entityId:id,detail:{enabled:body.enabled,role:body.role},ipAddress:requestIp(request)});
  return NextResponse.json({ok:true,user:result.rows[0]});
}
