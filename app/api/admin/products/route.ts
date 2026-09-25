import crypto from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { saveProductOverride } from "@/lib/runtimeCatalog";

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin","operator"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const id="custom-"+crypto.randomUUID();
  await saveProductOverride({
    productId:id,enabled:true,name:"New product",description:"Chef-prepared Simple Kitchen meal.",
    pricePence:775,category:"main",week:1,image:"",longDescription:"",ingredients:"",userId:session.userId
  });
  await auditAdmin({userId:session.userId,actorEmail:session.email,action:"product.create",entityType:"product",entityId:id,ipAddress:requestIp(request)});
  return NextResponse.json({ok:true,product:{
    id,name:"New product",description:"Chef-prepared Simple Kitchen meal.",price:7.75,category:"main",week:1,image:"",
    enabled:true,hasOverride:true,isCustom:true
  }});
}
