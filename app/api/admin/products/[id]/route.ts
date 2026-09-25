import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import { saveProductOverride } from "@/lib/runtimeCatalog";

const categories=new Set(["main","breakfast","soup","treat","special","gift"]);

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin","operator"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  const body=await request.json() as Record<string,unknown>;
  const week=body.week==null?null:Number(body.week);
  const pricePence=Number(body.pricePence);
  if(week!==null&&(!Number.isInteger(week)||week<1||week>6)) return NextResponse.json({error:"Week must be 1 to 6."},{status:400});
  if(!Number.isFinite(pricePence)||pricePence<0) return NextResponse.json({error:"Price is invalid."},{status:400});
  if(!categories.has(String(body.category))) return NextResponse.json({error:"Category is invalid."},{status:400});

  await saveProductOverride({
    productId:id,enabled:body.enabled!==false,name:String(body.name||"").trim(),
    description:String(body.description||""),pricePence:Math.round(pricePence),category:String(body.category),
    week,image:String(body.image||""),userId:session.userId
  });
  await auditAdmin({userId:session.userId,actorEmail:session.email,action:"product.update",entityType:"product",entityId:id,detail:{week,pricePence,enabled:body.enabled!==false},ipAddress:requestIp(request)});
  return NextResponse.json({ok:true});
}

export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  await db().query("DELETE FROM product_overrides WHERE product_id=$1",[id]);
  await auditAdmin({userId:session.userId,actorEmail:session.email,action:"product.reset",entityType:"product",entityId:id,ipAddress:requestIp(request)});
  return NextResponse.json({ok:true});
}
