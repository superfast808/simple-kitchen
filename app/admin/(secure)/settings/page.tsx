import { config } from "@/lib/config";
import { getAdminSetting } from "@/lib/adminSettings";
import { AdminSettingsClient } from "@/components/admin/AdminSettingsClient";

export const dynamic="force-dynamic";

export default async function AdminSettingsPage(){
  const [givingEnabled,givingStart,givingEnd]=await Promise.all([
    getAdminSetting("giving_enabled",config.givingEnabled),
    getAdminSetting("giving_start",config.givingStart),
    getAdminSetting("giving_end",config.givingEnd)
  ]);
  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Business controls</div><h1>Settings</h1><p>Campaign and business-wide switches that do not belong to a specific operational area.</p></div></header>
    <AdminSettingsClient initial={{givingEnabled:Boolean(givingEnabled),givingStart:String(givingStart),givingEnd:String(givingEnd)}}/>
  </div>;
}
