import { SubscriptionOptions } from "@/components/SubscriptionOptions";
import { PageHero } from "@/components/PageHero";
import { getRuntimeSubscriptionPlans } from "@/lib/runtimeSubscriptions";
import { getHeroConfig } from "@/lib/pageContent";

export const dynamic="force-dynamic";

export default async function SubscriptionsPage(){
  const [all,hero]=await Promise.all([getRuntimeSubscriptionPlans(),getHeroConfig("subscriptions")]);
  const plans=Object.values(all).filter((plan)=>plan.enabled&&plan.public&&plan.options.some((option)=>option.enabled!==false));
  return <>
    <PageHero hero={hero}/>
    <section className="section shell subscription-layout">
      <div><div className="eyebrow">Subscribe to Simple Kitchen</div><h2>Meals sorted around you</h2><p>Choose your meal quantity, then collection or an eligible delivery area. Delivery is postcode-checked before payment.</p><ul className="tick-list"><li>Flexible meal quantities</li><li>Choose different meals each cycle</li><li>Delivery or collection</li><li>Secure Stripe billing</li></ul></div>
      {plans.length?<SubscriptionOptions plans={plans}/>:<div className="subscription-box"><div className="error-box">New subscriptions are temporarily unavailable.</div></div>}
    </section>
  </>;
}
