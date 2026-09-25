import { NextRequest,NextResponse } from "next/server";
import { logoutCustomer } from "@/lib/customerAuth";
import { sameOriginMutation } from "@/lib/adminAuth";

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  await logoutCustomer();
  return NextResponse.redirect(new URL("/account",request.url),303);
}
