import { db } from "@/lib/db";
import { ensureCustomerSchema } from "@/lib/customerAuth";
import { AdminCustomersClient } from "@/components/admin/AdminCustomersClient";

export const dynamic="force-dynamic";

export default async function AdminCustomersPage(){
  await ensureCustomerSchema();
  const result=await db().query(`
    SELECT u.id,u.email,u.first_name,u.last_name,u.phone,u.enabled,u.email_verified,u.created_at,u.last_login_at,
      COUNT(DISTINCT o.id)::int AS orders_count,
      COALESCE(SUM(DISTINCT CASE WHEN o.id IS NOT NULL THEN o.total_pence ELSE NULL END),0)::int AS spend_pence,
      COUNT(DISTINCT s.id) FILTER (WHERE s.status='active')::int AS active_subscriptions
    FROM customer_users u
    LEFT JOIN orders o ON lower(o.customer->>'email')=lower(u.email) AND o.status IN ('paid','processing','completed')
    LEFT JOIN subscriptions s ON lower(s.customer_email)=lower(u.email)
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).catch(()=>({rows:[]}));
  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Customer accounts</div><h1>Customers</h1><p>Registered customer access with linked order and subscription activity.</p></div></header>
    <AdminCustomersClient initialRows={result.rows as any}/>
  </div>;
}
