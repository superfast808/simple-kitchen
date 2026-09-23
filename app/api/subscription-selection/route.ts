import { NextRequest, NextResponse } from "next/server";
import { getMenuState } from "@/lib/cycle";
import { productById } from "@/lib/catalog";
import { getSubscriptionByToken, saveSubscriptionSelection } from "@/lib/subscriptions";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { token:string; items:{id:string;quantity:number}[] };
    const subscription = await getSubscriptionByToken(body.token);
    if (!subscription || subscription.status !== "active") return NextResponse.json({ error:"Subscription link is invalid or inactive." }, { status:404 });
    const state = getMenuState();
    if (!state.open) return NextResponse.json({ error:"The weekly menu is currently closed. It reopens Saturday at 12 noon." }, { status:409 });

    const items = body.items.map((item) => {
      const product = productById.get(item.id);
      const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
      if (!product || product.weeks === "always" || !product.weeks.includes(state.week)) throw new Error("One selected meal is not in this week's menu.");
      return { id:product.id, name:product.name, quantity };
    }).filter((item) => item.quantity > 0);

    const total = items.reduce((sum,item) => sum + item.quantity, 0);
    if (total !== Number(subscription.meals_per_week)) {
      return NextResponse.json({ error:`Please choose exactly ${subscription.meals_per_week} meals.` }, { status:400 });
    }
    await saveSubscriptionSelection(String(subscription.id), state.windowStart.slice(0,10), items);
    return NextResponse.json({ ok:true });
  } catch (error) {
    return NextResponse.json({ error:error instanceof Error ? error.message : "Unable to save selection." }, { status:500 });
  }
}
