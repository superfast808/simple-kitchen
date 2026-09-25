import Stripe from "stripe";
import { getAdminSecret } from "./adminSettings";

let stripe:Stripe|null=null;
let stripeKey="";

export async function getStripe(){
  const key=await getAdminSecret("stripe_secret_key",process.env.STRIPE_SECRET_KEY||"");
  if(!key) throw new Error("Stripe secret key is not configured");
  if(!stripe||stripeKey!==key){
    stripe=new Stripe(key);
    stripeKey=key;
  }
  return stripe;
}

export async function getStripeWebhookSecret(){
  return getAdminSecret("stripe_webhook_secret",process.env.STRIPE_WEBHOOK_SECRET||"");
}
