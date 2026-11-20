import { config } from "@/lib/config";

export const dynamic="force-dynamic";

export default function SubscriptionSuccessPage(){
  const message=config.mealSelection==="site"
    ?"Thanks for subscribing to Simple Kitchen. Your meal-choice link is being sent to your email address."
    :"Thanks for subscribing to Simple Kitchen. Each week we’ll email you a link to choose your meals when the menu opens.";
  return <section className="section shell narrow"><div className="success-card"><span>✓</span><h1>Subscription active</h1><p>{message}</p></div></section>;
}
