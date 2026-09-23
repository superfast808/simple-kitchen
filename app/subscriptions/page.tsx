import { SubscriptionOptions } from "@/components/SubscriptionOptions";
import { config } from "@/lib/config";
import { subscriptionPlans } from "@/lib/subscriptionPlans";

export default function SubscriptionsPage(){
  const plans=[subscriptionPlans.weekly,subscriptionPlans.fortnightly];
  return <>
    <section className="page-hero"><div className="shell narrow"><div className="eyebrow">Meal subscriptions</div><h1>Subscriptions</h1><p>Join us on a subscription basis. Choose weekly or fortnightly meals, then use your personal link to select the meals you want from each live menu.</p></div></section>
    <section className="section shell subscription-layout">
      <div><div className="eyebrow">Subscribe to Simple Kitchen</div><h2>Meals sorted around you</h2><p>The live WooCommerce store offers weekly and fortnightly subscriptions with meal quantities from 4 to 30.</p><ul className="tick-list"><li>Weekly or fortnightly billing</li><li>Choose different meals each cycle</li><li>Delivery or collection</li><li>Secure Stripe billing</li></ul></div>
      <SubscriptionOptions plans={plans} deliveryFee={config.deliveryFeePence}/>
    </section>
  </>;
}
