import { NextResponse } from "next/server";
import { getMenuState } from "@/lib/cycle";
import { getCapacity } from "@/lib/orders";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = getMenuState();
  try {
    const capacity = await getCapacity(state.windowStart.slice(0,10), state.fulfilmentDate);
    return NextResponse.json({ ...capacity, open:state.open, week:state.week, fulfilmentDate:state.fulfilmentDate });
  } catch {
    return NextResponse.json({
      weeklyRemaining: config.weeklyItemCap,
      deliveryRemaining: config.deliverySlotCap,
      open: state.open, week: state.week, fulfilmentDate: state.fulfilmentDate,
      estimateOnly: true
    });
  }
}
