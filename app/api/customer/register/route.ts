import { NextRequest,NextResponse } from "next/server";
import { registerCustomer } from "@/lib/customerAuth";
import { requestIp,sameOriginMutation } from "@/lib/adminAuth";

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  try{
    const body=await request.json() as {email?:string;password?:string;firstName?:string;lastName?:string;phone?:string};
    await registerCustomer({
      email:String(body.email||""),password:String(body.password||""),firstName:String(body.firstName||""),
      lastName:String(body.lastName||""),phone:String(body.phone||""),ip:requestIp(request),userAgent:request.headers.get("user-agent")||""
    });
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to create account."},{status:400});
  }
}
