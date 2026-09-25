import { db } from "@/lib/db";
import { AdminSubscriptionsClient } from "@/components/admin/AdminSubscriptionsClient";

export const dynamic="force-dynamic";

export default async function AdminSubscriptionsPage(){
  const result=await db().query(`
    SELECT s.*,COUNT(ss.id)::int AS selection_count
    FROM subscriptions s
    LEFT JOIN subscription_selections ss ON ss.subscription_id=s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT 250
  `).catch(()=>({rows:[]}));
  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Recurring revenue</div><h1>Subscriptions</h1><p>Weekly, fortnightly and specialist twice-weekly plans in one view.</p></div></header>
    <AdminSubscriptionsClient initialRows={result.rows}/>
  </div>;
}
