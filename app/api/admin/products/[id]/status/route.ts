import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { db } from "@/lib/db";

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin","operator"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  try{
    const body=await request.json() as {enabled?:boolean};
    if(typeof body.enabled!=="boolean") throw new Error("Enabled state is required.");
    await db().query(`
      INSERT INTO product_overrides (product_id,enabled,updated_by,updated_at)
      VALUES ($1,$2,$3,now())
      ON CONFLICT (product_id) DO UPDATE SET enabled=EXCLUDED.enabled,updated_by=EXCLUDED.updated_by,updated_at=now()
    `,[id,body.enabled,session.userId]);
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"product.status",entityType:"product",entityId:id,detail:{enabled:body.enabled},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to update product status."},{status:400});
  }
}
