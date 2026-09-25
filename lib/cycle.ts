import { DateTime } from "luxon";
import { getRuntimeCommerceSettings,type RuntimeCommerceSettings } from "./runtimeConfig";

const ZONE="Europe/London";
const DEFAULT_ANCHOR="2025-03-15";
const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

export type MenuState={
  open:boolean;
  week:number;
  message:string;
  windowStart:string;
  windowEnd:string;
  fulfilmentDate:string;
  scheduledOpen:boolean;
  scheduleLabel:string;
};

type Schedule=Pick<RuntimeCommerceSettings,
  "cycleStartDate"|"menuForceState"|"menuOpenDay"|"menuOpenHour"|"menuOpenMinute"|
  "menuCloseDay"|"menuCloseHour"|"menuCloseMinute"|"fulfilmentOffsetDays">;

function atTime(base:DateTime,hour:number,minute:number){
  return base.set({hour,minute,second:0,millisecond:0});
}

function formatClock(hour:number,minute:number){
  return DateTime.fromObject({hour,minute},{zone:ZONE}).toFormat(minute===0?"h a":"h:mm a").toLowerCase();
}

function closeForOpen(open:DateTime,schedule:Schedule){
  let days=(schedule.menuCloseDay-schedule.menuOpenDay+7)%7;
  const openMinutes=schedule.menuOpenHour*60+schedule.menuOpenMinute;
  const closeMinutes=schedule.menuCloseHour*60+schedule.menuCloseMinute;
  if(days===0&&closeMinutes<=openMinutes) days=7;
  return atTime(open.plus({days}),schedule.menuCloseHour,schedule.menuCloseMinute);
}

export function buildMenuState(at:DateTime,schedule:Schedule):MenuState{
  const now=at.setZone(ZONE);
  const weekStart=now.startOf("week");
  const thisOpen=atTime(weekStart.plus({days:schedule.menuOpenDay-1}),schedule.menuOpenHour,schedule.menuOpenMinute);
  const activeOpen=now<thisOpen?thisOpen.minus({days:7}):thisOpen;
  const activeClose=closeForOpen(activeOpen,schedule);
  const scheduledOpen=now>=activeOpen&&now<=activeClose;

  let targetOpen:DateTime;
  let targetClose:DateTime;
  if(scheduledOpen){
    targetOpen=activeOpen;
    targetClose=activeClose;
  }else{
    const nextOpen=now<thisOpen?thisOpen:thisOpen.plus({days:7});
    targetOpen=nextOpen;
    targetClose=closeForOpen(nextOpen,schedule);
  }

  const anchor=atTime(DateTime.fromISO(schedule.cycleStartDate||DEFAULT_ANCHOR,{zone:ZONE}).startOf("day"),schedule.menuOpenHour,schedule.menuOpenMinute);
  const weeksElapsed=Math.max(0,Math.round(targetOpen.startOf("day").diff(anchor.startOf("day"),"weeks").weeks));
  const week=(weeksElapsed%6)+1;
  const forced=schedule.menuForceState;
  const open=forced==="open"?true:forced==="closed"?false:scheduledOpen;
  const scheduleLabel=DAYS[schedule.menuOpenDay-1]+" "+formatClock(schedule.menuOpenHour,schedule.menuOpenMinute)+" – "+DAYS[schedule.menuCloseDay-1]+" "+formatClock(schedule.menuCloseHour,schedule.menuCloseMinute);

  let message:string;
  if(forced==="open"&&!scheduledOpen) message="Ordering has been opened manually.";
  else if(forced==="closed"&&scheduledOpen) message="Ordering has been paused manually.";
  else if(open) message="Orders close "+DAYS[schedule.menuCloseDay-1]+" at "+formatClock(schedule.menuCloseHour,schedule.menuCloseMinute)+".";
  else message="Orders are closed. The next menu opens "+DAYS[schedule.menuOpenDay-1]+" at "+formatClock(schedule.menuOpenHour,schedule.menuOpenMinute)+".";

  return {
    open,week,message,scheduledOpen,scheduleLabel,
    windowStart:targetOpen.toISO()||"",
    windowEnd:targetClose.toISO()||"",
    fulfilmentDate:targetOpen.plus({days:schedule.fulfilmentOffsetDays}).toISODate()||""
  };
}

export function getMenuState(at=DateTime.now().setZone(ZONE)):MenuState{
  return buildMenuState(at,{
    cycleStartDate:process.env.CYCLE_START_DATE||DEFAULT_ANCHOR,menuForceState:"auto",
    menuOpenDay:6,menuOpenHour:12,menuOpenMinute:0,menuCloseDay:3,menuCloseHour:23,menuCloseMinute:59,fulfilmentOffsetDays:7
  });
}

export async function getRuntimeMenuState(at=DateTime.now().setZone(ZONE)):Promise<MenuState>{
  const runtime=await getRuntimeCommerceSettings();
  return buildMenuState(at,runtime);
}

export function previewMenuWindows(schedule:Schedule,count=6,from=DateTime.now().setZone(ZONE)){
  const first=buildMenuState(from,schedule);
  const start=DateTime.fromISO(first.windowStart,{zone:ZONE});
  return Array.from({length:count},(_,index)=>{
    const open=start.plus({weeks:index});
    const close=closeForOpen(open,schedule);
    const anchor=atTime(DateTime.fromISO(schedule.cycleStartDate||DEFAULT_ANCHOR,{zone:ZONE}).startOf("day"),schedule.menuOpenHour,schedule.menuOpenMinute);
    const weeksElapsed=Math.max(0,Math.round(open.startOf("day").diff(anchor.startOf("day"),"weeks").weeks));
    return {
      week:(weeksElapsed%6)+1,
      opens:open.toISO()||"",
      closes:close.toISO()||"",
      fulfilmentDate:open.plus({days:schedule.fulfilmentOffsetDays}).toISODate()||""
    };
  });
}
