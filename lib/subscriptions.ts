import { db } from "./db";

let schemaReady:Promise<void>|null=null;

async function ensureSubscriptionSchema(){
  if(!schemaReady){
    schemaReady=(async()=>{
      await db().query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cadence_weeks integer NOT NULL DEFAULT 1");
      await db().query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS source_plan text NOT NULL DEFAULT 'weekly'");
      await db().query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS selection_token uuid NOT NULL DEFAULT gen_random_uuid()");
      await db().query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_address jsonb");
      await db().query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_zone text");
      await db().query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_fee_pence integer NOT NULL DEFAULT 0");
      await db().query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id text");
      await db().query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS customer_name text");
      await db().query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()");
      await db().query("CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_selection_token_unique_idx ON subscriptions (selection_token)");
    })();
  }
  await schemaReady;
}

export async function upsertStripeSubscription(input:{
  stripeSubscriptionId:string;
  stripeCustomerId?:string;
  email:string;
  name?:string;
  meals:number;
  fulfilment:"delivery"|"collection";
  cadenceWeeks:number;
  sourcePlan:string;
  deliveryAddress?:Record<string,string>;
  deliveryZone?:string;
  deliveryFeePence?:number;
}){
  await ensureSubscriptionSchema();
  const result=await db().query(
    "INSERT INTO subscriptions (stripe_subscription_id,stripe_customer_id,customer_email,customer_name,meals_per_week,fulfilment,cadence_weeks,source_plan,delivery_address,delivery_zone,delivery_fee_pence) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) ON CONFLICT (stripe_subscription_id) DO UPDATE SET stripe_customer_id=EXCLUDED.stripe_customer_id,customer_email=EXCLUDED.customer_email,customer_name=EXCLUDED.customer_name,meals_per_week=EXCLUDED.meals_per_week,fulfilment=EXCLUDED.fulfilment,cadence_weeks=EXCLUDED.cadence_weeks,source_plan=EXCLUDED.source_plan,delivery_address=EXCLUDED.delivery_address,delivery_zone=EXCLUDED.delivery_zone,delivery_fee_pence=EXCLUDED.delivery_fee_pence,updated_at=now() RETURNING selection_token",
    [input.stripeSubscriptionId,input.stripeCustomerId||null,input.email,input.name||null,input.meals,input.fulfilment,input.cadenceWeeks,input.sourcePlan,JSON.stringify(input.deliveryAddress||{}),input.deliveryZone||null,input.deliveryFeePence||0]
  );
  return String(result.rows[0].selection_token);
}

export async function getSubscriptionByToken(token:string){
  await ensureSubscriptionSchema();
  const result=await db().query(
    "SELECT id,customer_email,customer_name,meals_per_week,fulfilment,status,cadence_weeks,source_plan,delivery_address,delivery_zone,delivery_fee_pence FROM subscriptions WHERE selection_token=$1",
    [token]
  );
  return result.rows[0]||null;
}

export async function saveSubscriptionSelection(subscriptionId:string,cycleKey:string,selection:unknown){
  await db().query(
    "INSERT INTO subscription_selections (subscription_id,cycle_key,selection) VALUES ($1,$2,$3::jsonb) ON CONFLICT (subscription_id,cycle_key) DO UPDATE SET selection=EXCLUDED.selection,updated_at=now()",
    [subscriptionId,cycleKey,JSON.stringify(selection)]
  );
}

export async function activeSubscriptionLinks(){
  await ensureSubscriptionSchema();
  const result=await db().query(
    "SELECT customer_email,customer_name,selection_token,cadence_weeks,source_plan FROM subscriptions WHERE status='active' AND (cadence_weeks=1 OR MOD(FLOOR(EXTRACT(EPOCH FROM (now()-created_at))/604800)::int,cadence_weeks)=0)"
  );
  return result.rows;
}


export async function deactivateStripeSubscription(stripeSubscriptionId:string){
  await ensureSubscriptionSchema();
  const result=await db().query(
    "UPDATE subscriptions SET status='cancelled',updated_at=now() WHERE stripe_subscription_id=$1 RETURNING customer_email",
    [stripeSubscriptionId]
  );
  return result.rows[0]?.customer_email?String(result.rows[0].customer_email):"";
}
