import { SubscriptionOptions } from "@/components/SubscriptionOptions";
import { getRuntimeSubscriptionPlans } from "@/lib/runtimeSubscriptions";

export const dynamic="force-dynamic";

export default async function SubscriptionsPage(){
  const all=await getRuntimeSubscriptionPlans();
  const plans=Object.values(all).filter((plan)=>plan.enabled&&plan.public);
  return <>
    <section className="page-hero"><div className="shell narrow"><div className="eyebrow">Meal subscriptions</div><h1>Subscriptions</h1><p>Choose the subscription rhythm that suits you, then select your meals from each live menu.</p></div></section>
    <section className="section shell subscription-layout">
      <div><div className="eyebrow">Subscribe to Simple Kitchen</div><h2>Meals sorted around you</h2><p>Choose your meal quantity, then collection or an eligible delivery area. Delivery is postcode-checked before payment.</p><ul className="tick-list"><li>Flexible meal quantities</li><li>Choose different meals each cycle</li><li>Delivery or collection</li><li>Secure Stripe billing</li></ul></div>
      {plans.length?<SubscriptionOptions plans={plans}/>:<div className="subscription-box"><div className="error-box">New subscriptions are temporarily unavailable.</div></div>}
    </section>
  </>;
}
