import { NextRequest,NextResponse } from "next/server";
import { logoutAdmin,sameOriginMutation } from "@/lib/adminAuth";

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  await logoutAdmin();
  return NextResponse.redirect(new URL("/admin/login",request.url),303);
}
