import { NextRequest,NextResponse } from "next/server";
import { quoteDelivery,collectionAvailable } from "@/lib/fulfilment";

export async function GET(request:NextRequest){
  const postcode=request.nextUrl.searchParams.get("postcode")||"";
  const subtotalPence=Math.max(0,Number(request.nextUrl.searchParams.get("subtotalPence")||0)||0);
  const [delivery,collection]=await Promise.all([quoteDelivery(postcode,subtotalPence),collectionAvailable()]);
  return NextResponse.json({
    collection:{allowed:collection,feePence:0},
    delivery
  });
}
