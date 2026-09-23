import { SubscriptionSelector } from "@/components/SubscriptionSelector";
import { productsForWeek } from "@/lib/catalog";
import { getMenuState } from "@/lib/cycle";
import { getSubscriptionByToken } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

export default async function SubscriptionSelectPage({ searchParams }: { searchParams: Promise<{token?:string}> }) {
  const { token="" } = await searchParams;
  const subscription = token ? await getSubscriptionByToken(token).catch(()=>null) : null;
  const state = getMenuState();
  if (!subscription) return <section className="section shell narrow"><div className="error-box">This subscription link is invalid or no longer active.</div></section>;
  if (!state.open) return <section className="section shell narrow"><div className="success-card"><h1>The menu is closed just now</h1><p>Come back from Saturday at 12 noon to choose your next Simple Kitchen meals.</p></div></section>;
  const menu=productsForWeek(state.week,true).filter(p=>p.weeks!=="always"&&p.category==="main");
  return <><section className="page-hero"><div className="shell narrow"><div className="eyebrow">Subscriber menu · Week {state.week}</div><h1>Choose your meals</h1><p>{subscription.customer_name ? `Hi ${subscription.customer_name}. ` : ""}Choose exactly {subscription.meals_per_week} meals for this week.</p></div></section><section className="section shell"><SubscriptionSelector token={token} meals={Number(subscription.meals_per_week)} products={menu}/></section></>;
}
