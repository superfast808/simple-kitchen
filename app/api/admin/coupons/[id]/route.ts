import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { deleteCoupon } from "@/lib/coupons";

export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  try{
    const result=await deleteCoupon(id);
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"coupon."+result,entityType:"coupon",entityId:id,ipAddress:requestIp(request)});
    return NextResponse.json({ok:true,result});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to remove coupon."},{status:400});
  }
}
