import { NextRequest,NextResponse } from "next/server";
import { quoteDelivery,collectionAvailable } from "@/lib/fulfilment";

export async function GET(request:NextRequest){
  const postcode=request.nextUrl.searchParams.get("postcode")||"";
  const delivery=quoteDelivery(postcode);
  return NextResponse.json({
    collection:{allowed:collectionAvailable(),feePence:0},
    delivery
  });
}
