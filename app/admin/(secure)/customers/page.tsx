import { db } from "@/lib/db";
import { ensureCustomerSchema } from "@/lib/customerAuth";
import { AdminCustomersClient } from "@/components/admin/AdminCustomersClient";

export const dynamic="force-dynamic";

export default async function AdminCustomersPage(){
  await ensureCustomerSchema();
  const result=await db().query(`
    SELECT u.id,u.email,u.first_name,u.last_name,u.phone,u.enabled,u.email_verified,u.created_at,u.last_login_at,
      COALESCE(o.orders_count,0)::int AS orders_count,
      COALESCE(o.spend_pence,0)::int AS spend_pence,
      COALESCE(s.active_subscriptions,0)::int AS active_subscriptions
    FROM customer_users u
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS orders_count,COALESCE(SUM(total_pence),0)::int AS spend_pence
      FROM orders
      WHERE lower(customer->>'email')=lower(u.email) AND status IN ('paid','processing','completed')
    ) o ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE status='active')::int AS active_subscriptions
      FROM subscriptions WHERE lower(customer_email)=lower(u.email)
    ) s ON true
    ORDER BY u.created_at DESC
  `).catch(()=>({rows:[]}));
  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Customer accounts</div><h1>Customers</h1><p>Registered customer access with linked order and subscription activity.</p></div></header>
    <AdminCustomersClient initialRows={result.rows as any}/>
  </div>;
}
