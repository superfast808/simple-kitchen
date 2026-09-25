import { NextRequest,NextResponse } from "next/server";
import { quoteDelivery,collectionAvailable } from "@/lib/fulfilment";

export async function GET(request:NextRequest){
  const postcode=request.nextUrl.searchParams.get("postcode")||"";
  const [delivery,collection]=await Promise.all([quoteDelivery(postcode),collectionAvailable()]);
  return NextResponse.json({
    collection:{allowed:collection,feePence:0},
    delivery
  });
}
