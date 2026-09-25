import { requireAdmin } from "@/lib/adminAuth";
import { getAdminSecret } from "@/lib/adminSettings";
import { db } from "@/lib/db";
import { AdminSystemClient } from "@/components/admin/AdminSystemClient";

export const dynamic="force-dynamic";

export default async function AdminSystemPage(){
  const session=await requireAdmin();
  const [users,audit,sessions,failed,stripeKey,webhookSecret,clicksendKey,smtpPass]=await Promise.all([
    db().query("SELECT id,email,display_name,role,enabled,last_login_at,created_at FROM admin_users ORDER BY created_at DESC").catch(()=>({rows:[]})),
    db().query("SELECT id,actor_email,action,entity_type,entity_id,detail,created_at FROM admin_audit_log ORDER BY created_at DESC LIMIT 100").catch(()=>({rows:[]})),
    db().query("SELECT COUNT(*)::int AS count FROM admin_sessions WHERE expires_at>now()").catch(()=>({rows:[{count:0}]})),
    db().query("SELECT COUNT(*)::int AS count FROM admin_login_attempts WHERE success=false AND attempted_at>now()-interval '24 hours'").catch(()=>({rows:[{count:0}]})),
    getAdminSecret("stripe_secret_key",process.env.STRIPE_SECRET_KEY||""),
    getAdminSecret("stripe_webhook_secret",process.env.STRIPE_WEBHOOK_SECRET||""),
    getAdminSecret("clicksend_api_key",process.env.CLICKSEND_API_KEY||""),
    getAdminSecret("smtp_pass",process.env.SMTP_PASS||"")
  ]);

  const dbOk=await db().query("SELECT 1 AS ok").then(()=>true).catch(()=>false);
  const checks=[
    {label:"PostgreSQL",ok:dbOk,note:dbOk?"Database responding normally":"Database query failed"},
    {label:"Admin encryption key",ok:Boolean(process.env.ADMIN_ENCRYPTION_KEY||process.env.ADMIN_SESSION_SECRET),note:"Required to encrypt secrets at rest"},
    {label:"Cron secret",ok:Boolean(process.env.CRON_SECRET),note:"Protects scheduled reminder endpoints"},
    {label:"Stripe secret",ok:Boolean(stripeKey),note:"Checkout and subscriptions"},
    {label:"Stripe webhook",ok:Boolean(webhookSecret),note:"Payment/subscription event verification"},
    {label:"ClickSend",ok:Boolean(clicksendKey),note:"Weekly SMS reminder transport"},
    {label:"SMTP password",ok:Boolean(smtpPass),note:"Subscription and operational email"}
  ];

  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Governance & diagnostics</div><h1>System & audit</h1><p>Security, admin access, configuration health and privileged activity.</p></div></header>
    <AdminSystemClient currentUserId={session.userId} initial={{
      users:users.rows,audit:audit.rows,activeSessions:Number(sessions.rows[0]?.count||0),
      failedLogins:Number(failed.rows[0]?.count||0),checks
    }}/>
  </div>;
}
