import Link from "next/link";
import { db } from "@/lib/db";
import { reminderCandidates } from "@/lib/smsReminders";
import { getMenuState } from "@/lib/cycle";

export const dynamic="force-dynamic";

function money(pence:number){return "£"+(pence/100).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2});}

export default async function AdminDashboard(){
  const [orderStats,subStats,recentOrders,sms]=await Promise.all([
    db().query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at>=date_trunc('day',now()))::int AS orders_today,
        COUNT(*) FILTER (WHERE created_at>=date_trunc('week',now()))::int AS orders_week,
        COALESCE(SUM(total_pence) FILTER (WHERE status IN ('paid','processing','completed') AND created_at>=date_trunc('week',now())),0)::int AS revenue_week,
        COUNT(*) FILTER (WHERE status='pending' AND (expires_at IS NULL OR expires_at>now()))::int AS pending
      FROM orders`
    ).catch(()=>({rows:[{}]})),
    db().query("SELECT COUNT(*) FILTER (WHERE status='active')::int AS active,COUNT(*)::int AS total FROM subscriptions").catch(()=>({rows:[{}]})),
    db().query("SELECT id,created_at,status,fulfilment,total_pence,customer FROM orders ORDER BY created_at DESC LIMIT 6").catch(()=>({rows:[]})),
    reminderCandidates().catch(()=>({rows:[],weekStart:"",lookbackDays:90}))
  ]);
  const state=getMenuState();
  const orders=orderStats.rows[0]||{};
  const subs=subStats.rows[0]||{};

  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Friday operations</div><h1>Overview</h1><p>What needs attention across Simple Kitchen right now.</p></div><div className={state.open?"admin-status live":"admin-status"}><span></span>{state.open?"Ordering open":"Ordering closed"} · Week {state.week}</div></header>

    <div className="admin-stat-grid">
      <div className="admin-stat"><small>Orders today</small><strong>{Number(orders.orders_today||0)}</strong><span>{Number(orders.orders_week||0)} this week</span></div>
      <div className="admin-stat"><small>Revenue this week</small><strong>{money(Number(orders.revenue_week||0))}</strong><span>Paid / processing / completed</span></div>
      <div className="admin-stat"><small>Active subscriptions</small><strong>{Number(subs.active||0)}</strong><span>{Number(subs.total||0)} recorded</span></div>
      <div className="admin-stat"><small>SMS candidates</small><strong>{sms.rows.length}</strong><span>{sms.lookbackDays}-day audience after exclusions</span></div>
    </div>

    <div className="admin-grid-2">
      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>Recent orders</h2><p>Latest checkout activity.</p></div><Link href="/admin/orders">View all</Link></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Customer</th><th>Type</th><th>Total</th><th>Status</th></tr></thead><tbody>
          {recentOrders.rows.map((row:any)=><tr key={row.id}><td><strong>{row.customer?.name||"Customer"}</strong><small>{row.customer?.email||""}</small></td><td>{row.fulfilment}</td><td>{money(Number(row.total_pence||0))}</td><td><span className={"admin-badge "+String(row.status)}>{row.status}</span></td></tr>)}
          {!recentOrders.rows.length&&<tr><td colSpan={4}>No orders yet.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>Action centre</h2><p>Fast routes to the controls used most often.</p></div></div>
        <div className="admin-action-list">
          <Link href="/admin/fulfilment"><span>⌖</span><div><strong>Delivery & collection</strong><small>Areas, fees, minimums and capacity</small></div><b>›</b></Link>
          <Link href="/admin/menu"><span>◫</span><div><strong>Menu & products</strong><small>Availability, pricing and cycle weeks</small></div><b>›</b></Link>
          <Link href="/admin/messaging"><span>✉</span><div><strong>Messaging</strong><small>Preview SMS audience and integrations</small></div><b>›</b></Link>
          <Link href="/admin/system"><span>⌁</span><div><strong>System health</strong><small>Configuration and audit history</small></div><b>›</b></Link>
        </div>
      </section>
    </div>
  </div>;
}
