import { db } from "./db";

export async function upsertStripeSubscription(input: {
  stripeSubscriptionId: string;
  stripeCustomerId?: string;
  email: string;
  name?: string;
  meals: number;
  fulfilment: "delivery" | "collection";
}) {
  const result = await db().query(
    `INSERT INTO subscriptions (stripe_subscription_id,stripe_customer_id,customer_email,customer_name,meals_per_week,fulfilment)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (stripe_subscription_id) DO UPDATE SET
       stripe_customer_id=EXCLUDED.stripe_customer_id,
       customer_email=EXCLUDED.customer_email,
       customer_name=EXCLUDED.customer_name,
       meals_per_week=EXCLUDED.meals_per_week,
       fulfilment=EXCLUDED.fulfilment,
       updated_at=now()
     RETURNING selection_token`,
    [input.stripeSubscriptionId,input.stripeCustomerId || null,input.email,input.name || null,input.meals,input.fulfilment]
  );
  return String(result.rows[0].selection_token);
}

export async function getSubscriptionByToken(token: string) {
  const result = await db().query(
    "SELECT id,customer_email,customer_name,meals_per_week,fulfilment,status FROM subscriptions WHERE selection_token=$1",
    [token]
  );
  return result.rows[0] || null;
}

export async function saveSubscriptionSelection(subscriptionId: string, cycleKey: string, selection: unknown) {
  await db().query(
    `INSERT INTO subscription_selections (subscription_id,cycle_key,selection)
     VALUES ($1,$2,$3::jsonb)
     ON CONFLICT (subscription_id,cycle_key) DO UPDATE SET selection=EXCLUDED.selection,updated_at=now()`,
    [subscriptionId,cycleKey,JSON.stringify(selection)]
  );
}

export async function activeSubscriptionLinks() {
  const result = await db().query(
    "SELECT customer_email,customer_name,selection_token FROM subscriptions WHERE status='active'"
  );
  return result.rows;
}
