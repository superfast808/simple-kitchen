import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,hashAdminPassword,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { db } from "@/lib/db";

const roles=new Set(["viewer","operator","admin","owner"]);

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner"]);
  if(!session) return NextResponse.json({error:"Owner access required."},{status:403});
  try{
    const body=await request.json() as {email?:string;name?:string;role?:string;password?:string};
    const email=String(body.email||"").trim().toLowerCase();
    const name=String(body.name||"").trim()||"Administrator";
    const role=String(body.role||"operator");
    if(!email.includes("@")) throw new Error("A valid email address is required.");
    if(!roles.has(role)) throw new Error("Invalid role.");
    const passwordHash=hashAdminPassword(String(body.password||""));
    const result=await db().query(
      "INSERT INTO admin_users (email,display_name,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id,email,display_name,role,enabled,last_login_at,created_at",
      [email,name,passwordHash,role]
    );
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"admin_user.create",entityType:"admin_user",entityId:String(result.rows[0].id),detail:{email,role},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true,user:result.rows[0]});
  }catch(error){
    const message=error instanceof Error?error.message:"Unable to create admin user.";
    return NextResponse.json({error:message.includes("duplicate key")?"An admin with that email already exists.":message},{status:400});
  }
}
