import { NextResponse } from "next/server";
import { getRuntimeMenuState } from "@/lib/cycle";
import { getCapacity } from "@/lib/orders";
import { getRuntimeCommerceSettings } from "@/lib/runtimeConfig";

export const dynamic="force-dynamic";

export async function GET(){
  const state=await getRuntimeMenuState();
  try{
    const capacity=await getCapacity(state.windowStart.slice(0,10),state.fulfilmentDate);
    return NextResponse.json({...capacity,open:state.open,week:state.week,fulfilmentDate:state.fulfilmentDate});
  }catch{
    const runtime=await getRuntimeCommerceSettings();
    return NextResponse.json({
      weeklyRemaining:runtime.weeklyItemCap,
      deliveryRemaining:runtime.deliverySlotCap,
      open:state.open,week:state.week,fulfilmentDate:state.fulfilmentDate,
      estimateOnly:true
    });
  }
}
