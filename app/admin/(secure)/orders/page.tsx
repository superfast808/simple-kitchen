import { db } from "@/lib/db";
import { AdminOrdersClient } from "@/components/admin/AdminOrdersClient";

export const dynamic="force-dynamic";

export default async function AdminOrdersPage(){
  const result=await db().query(`
    SELECT o.*,
      COALESCE(json_agg(json_build_object('name',oi.name,'quantity',oi.quantity,'unit_price_pence',oi.unit_price_pence) ORDER BY oi.id)
        FILTER (WHERE oi.id IS NOT NULL),'[]'::json) AS items
    FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
    GROUP BY o.id
    ORDER BY o.created_at DESC LIMIT 250
  `).catch(()=>({rows:[]}));
  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Commerce</div><h1>Orders</h1><p>Search, inspect and manage order fulfilment from one place.</p></div></header>
    <AdminOrdersClient initialRows={result.rows}/>
  </div>;
}
