import { config } from "@/lib/config";
import { getAdminSecret,getAdminSetting } from "@/lib/adminSettings";
import { getRuntimeCommerceSettings } from "@/lib/runtimeConfig";
import { AdminSettingsClient } from "@/components/admin/AdminSettingsClient";

export const dynamic="force-dynamic";

export default async function AdminSettingsPage(){
  const runtime=await getRuntimeCommerceSettings();
  const [givingEnabled,givingStart,givingEnd,stripeKey,webhookSecret]=await Promise.all([
    getAdminSetting("giving_enabled",config.givingEnabled),
    getAdminSetting("giving_start",config.givingStart),
    getAdminSetting("giving_end",config.givingEnd),
    getAdminSecret("stripe_secret_key",process.env.STRIPE_SECRET_KEY||""),
    getAdminSecret("stripe_webhook_secret",process.env.STRIPE_WEBHOOK_SECRET||"")
  ]);
  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Business controls</div><h1>Settings</h1><p>High-impact operational settings and payment configuration.</p></div></header>
    <AdminSettingsClient initial={{
      cycleStartDate:runtime.cycleStartDate,menuForceState:runtime.menuForceState,
      givingEnabled:Boolean(givingEnabled),givingStart:String(givingStart),givingEnd:String(givingEnd),
      stripeConfigured:Boolean(stripeKey),stripeWebhookConfigured:Boolean(webhookSecret)
    }}/>
  </div>;
}
