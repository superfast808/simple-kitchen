import { db } from "@/lib/db";
import { AdminSubscriptionsClient } from "@/components/admin/AdminSubscriptionsClient";
import { AdminSubscriptionPlans } from "@/components/admin/AdminSubscriptionPlans";
import { getRuntimeSubscriptionPlans } from "@/lib/runtimeSubscriptions";

export const dynamic="force-dynamic";

export default async function AdminSubscriptionsPage(){
  const [result,planMap]=await Promise.all([
    db().query(`
      SELECT s.*,COUNT(ss.id)::int AS selection_count
      FROM subscriptions s
      LEFT JOIN subscription_selections ss ON ss.subscription_id=s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT 250
    `).catch(()=>({rows:[]})),
    getRuntimeSubscriptionPlans()
  ]);
  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Recurring revenue</div><h1>Subscriptions</h1><p>Plan pricing, public availability, subscribers and meal-selection operations.</p></div></header>
    <AdminSubscriptionPlans initial={Object.values(planMap)}/>
    <AdminSubscriptionsClient initialRows={result.rows}/>
  </div>;
}
