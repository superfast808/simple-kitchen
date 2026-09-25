import { AdminWeekManager } from "@/components/admin/AdminWeekManager";
import { getRuntimeCommerceSettings } from "@/lib/runtimeConfig";
import { getRuntimeMenuState,previewMenuWindows } from "@/lib/cycle";

export const dynamic="force-dynamic";

export default async function AdminWeeksPage(){
  const runtime=await getRuntimeCommerceSettings();
  const state=await getRuntimeMenuState();
  const preview=previewMenuWindows(runtime,6);
  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Menu cycle</div><h1>Weeks & schedule</h1><p>Manage the six-week rotation and exactly when customers can order.</p></div></header>
    <AdminWeekManager
      initial={{
        cycleStartDate:runtime.cycleStartDate,menuForceState:runtime.menuForceState,
        menuOpenDay:runtime.menuOpenDay,menuOpenHour:runtime.menuOpenHour,menuOpenMinute:runtime.menuOpenMinute,
        menuCloseDay:runtime.menuCloseDay,menuCloseHour:runtime.menuCloseHour,menuCloseMinute:runtime.menuCloseMinute,
        fulfilmentOffsetDays:runtime.fulfilmentOffsetDays
      }}
      preview={preview}
      currentWeek={state.week}
      currentOpen={state.open}
      scheduleLabel={state.scheduleLabel}
    />
  </div>;
}
