import Link from "next/link";
import { CustomerAuthForms } from "@/components/CustomerAuthForms";
import { PageHero } from "@/components/PageHero";
import { getCustomerSession } from "@/lib/customerAuth";
import { getHeroConfig } from "@/lib/pageContent";
import { db } from "@/lib/db";

export const dynamic="force-dynamic";

function money(pence:number){return "£"+(Number(pence||0)/100).toFixed(2);}

export default async function AccountPage(){
  const [session,hero]=await Promise.all([getCustomerSession(),getHeroConfig("account")]);
  if(!session){
    return <><PageHero hero={hero}/><section className="section shell narrow">
      <div className="account-card">
        <p>Sign in to see previous orders and subscriptions, or create an account using the same email address you have ordered with before.</p>
        <CustomerAuthForms/>
      </div>
    </section></>;
  }

  const [orders,subscriptions]=await Promise.all([
    db().query(
      `SELECT id,created_at,status,fulfilment,total_pence,coupon_code,discount_pence
       FROM orders WHERE lower(customer->>'email')=lower($1)
       ORDER BY created_at DESC LIMIT 50`,
      [session.email]
    ).catch(()=>({rows:[]})),
    db().query(
      `SELECT id,created_at,status,meals_per_week,fulfilment,cadence_weeks,source_plan
       FROM subscriptions WHERE lower(customer_email)=lower($1)
       ORDER BY created_at DESC`,
      [session.email]
    ).catch(()=>({rows:[]}))
  ]);

  return <><PageHero hero={hero}/><section className="section shell">
    <div className="account-dashboard-head">
      <div><div className="eyebrow">Signed in</div><h1>Hi {session.firstName||"there"}</h1><p>{session.email}</p></div>
      <form action="/api/customer/logout" method="post"><button className="btn btn-ghost">Sign out</button></form>
    </div>

    <div className="account-summary-grid">
      <div className="account-summary-card"><small>Orders</small><strong>{orders.rows.length}</strong><span>Linked by your account email</span></div>
      <div className="account-summary-card"><small>Active subscriptions</small><strong>{subscriptions.rows.filter((row:any)=>row.status==="active").length}</strong><span>Recurring meal plans</span></div>
      <div className="account-summary-card"><small>Phone</small><strong className="small-value">{session.phone||"Not set"}</strong><span>Used for order contact</span></div>
    </div>

    <div className="account-section-grid">
      <section className="account-panel">
        <div className="account-panel-head"><div><h2>Your orders</h2><p>Orders using {session.email}</p></div><Link href="/order">Order again</Link></div>
        <div className="account-order-list">
          {orders.rows.map((row:any)=><div className="account-order-row" key={row.id}>
            <div><strong>{new Date(row.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</strong><small>#{String(row.id).slice(0,8)}</small></div>
            <div><strong>{money(row.total_pence)}</strong><small style={{textTransform:"capitalize"}}>{row.fulfilment}</small></div>
            <span className={"admin-badge "+row.status}>{String(row.status).replace("_"," ")}</span>
          </div>)}
          {!orders.rows.length&&<div className="empty-state"><p>No orders are linked to this email yet.</p><Link className="btn btn-small" href="/order">View this week’s menu</Link></div>}
        </div>
      </section>

      <section className="account-panel">
        <div className="account-panel-head"><div><h2>Subscriptions</h2><p>Your recurring Simple Kitchen plans.</p></div><Link href="/subscriptions">View plans</Link></div>
        <div className="account-order-list">
          {subscriptions.rows.map((row:any)=><div className="account-order-row" key={row.id}>
            <div><strong>{row.meals_per_week} meals</strong><small>{row.cadence_weeks===2?"Fortnightly":row.source_plan==="twice-weekly"?"Twice weekly":"Weekly"}</small></div>
            <div><strong style={{textTransform:"capitalize"}}>{row.fulfilment}</strong><small>{new Date(row.created_at).toLocaleDateString("en-GB")}</small></div>
            <span className={"admin-badge "+row.status}>{row.status}</span>
          </div>)}
          {!subscriptions.rows.length&&<div className="empty-state"><p>No subscriptions are linked to this email.</p><Link className="btn btn-small" href="/subscriptions">Explore subscriptions</Link></div>}
        </div>
      </section>
    </div>
  </section></>;
}
