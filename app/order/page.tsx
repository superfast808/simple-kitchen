import { ProductGrid } from "@/components/ProductGrid";
import { getRuntimeMenuState } from "@/lib/cycle";
import { getRuntimeProductsForWeek } from "@/lib/runtimeCatalog";
export const dynamic="force-dynamic";

export default async function OrderPage(){
  const state=await getRuntimeMenuState();
  const menu=await getRuntimeProductsForWeek(state.week,state.open);
  return <>
    <section className="page-hero"><div className="shell narrow"><div className="eyebrow">Our menu</div><h1>Order Here</h1><p>Simply order before Wednesday midnight to secure your order for Saturday coming. At checkout choose collection or delivery, subject to coverage.</p></div></section>
    <section className="section shell">
      <div className={state.open?"menu-status status-open":"menu-status status-closed"}><div><span>{state.open?"We’re open for orders":"Orders are closed"}</span><strong>{state.message}</strong></div><div className="week-pill">Menu week {state.week} of 6</div></div>
      <div className="section-heading left"><div className="eyebrow">{state.open?"This Week’s Menu":"Still available"}</div><h2>{state.open?"Choose your favourites":"Gift cards"}</h2></div>
      <ProductGrid products={menu}/>
      <div className="allergen-note"><strong>Good to know:</strong> Produced in a kitchen which handles CELERY, WHEAT, FISH, CRUSTACEAN, EGG, MILK, MUSTARD, NUTS, PEANUTS, SESAME, SOY and SULPHITES.</div>
    </section>
  </>;
}
