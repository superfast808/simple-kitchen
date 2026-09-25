import { NextRequest,NextResponse } from "next/server";
import { loginAdmin,requestIp,sameOriginMutation } from "@/lib/adminAuth";

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  try{
    const body=await request.json() as {email?:string;password?:string};
    if(!body.email||!body.password) return NextResponse.json({error:"Email and password are required."},{status:400});
    await loginAdmin({
      email:body.email,
      password:body.password,
      ip:requestIp(request),
      userAgent:request.headers.get("user-agent")||""
    });
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to sign in."},{status:401});
  }
}
