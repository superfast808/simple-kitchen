import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { config } from "@/lib/config";
import { sendMail } from "@/lib/mail";
import { markOrderStatusBySession } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { upsertStripeSubscription } from "@/lib/subscriptions";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) return new NextResponse("Webhook not configured", { status:400 });

  try {
    const raw = await request.text();
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment") {
        await markOrderStatusBySession(session.id, "paid");
      }
      if (session.mode === "subscription" && session.metadata?.type === "subscription" && session.subscription) {
        const token = await upsertStripeSubscription({
          stripeSubscriptionId: String(session.subscription),
          stripeCustomerId: session.customer ? String(session.customer) : undefined,
          email: session.customer_details?.email || "",
          name: session.metadata.customerName || session.customer_details?.name || undefined,
          meals: Number(session.metadata.meals),
          fulfilment: session.metadata.fulfilment === "delivery" ? "delivery" : "collection"
        });
        const url = `${config.siteUrl}/subscription-select?token=${token}`;
        await sendMail(
          session.customer_details?.email || "",
          "Choose your Simple Kitchen meals",
          `<h2>Your Simple Kitchen subscription is active</h2><p>Use the link below each week to choose your meals.</p><p><a href="${url}">Choose this week's meals</a></p>`
        );
      }
    }
    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment") await markOrderStatusBySession(session.id, "expired");
    }
    if (event.type === "customer.subscription.deleted") {
      // Kept deliberately minimal: Stripe remains the source of truth for cancellation.
    }

    return NextResponse.json({ received:true });
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : "Webhook error", { status:400 });
  }
}
