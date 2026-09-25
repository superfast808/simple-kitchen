import { DateTime } from "luxon";
import { getRuntimeCommerceSettings } from "./runtimeConfig";

const ZONE="Europe/London";
const DEFAULT_ANCHOR="2025-03-15";

export type MenuState={
  open:boolean;
  week:number;
  message:string;
  windowStart:string;
  windowEnd:string;
  fulfilmentDate:string;
};

function buildMenuState(at:DateTime,anchorRaw:string,force:"auto"|"open"|"closed"="auto"):MenuState{
  const now=at.setZone(ZONE);
  const anchor=DateTime.fromISO(anchorRaw||DEFAULT_ANCHOR,{zone:ZONE}).set({hour:12,minute:0,second:0,millisecond:0});
  const weeksElapsed=Math.max(0,Math.floor(now.diff(anchor,"weeks").weeks));
  const week=(weeksElapsed%6)+1;
  const weekday=now.weekday;
  const minutes=now.hour*60+now.minute;
  const scheduledOpen=now>=anchor&&((weekday===6&&minutes>=720)||weekday===7||weekday<=3);
  const open=force==="open"?true:force==="closed"?false:scheduledOpen;

  let start:DateTime;
  if(scheduledOpen){
    const daysSinceSaturday=weekday===7?1:weekday<=3?weekday+1:0;
    start=now.startOf("day").minus({days:daysSinceSaturday}).set({hour:12});
  }else{
    let daysToSaturday=(6-weekday+7)%7;
    if(weekday===6&&minutes>=720) daysToSaturday=7;
    start=now.startOf("day").plus({days:daysToSaturday}).set({hour:12});
  }

  const end=start.plus({days:4}).endOf("day");
  const fulfilment=start.plus({days:7}).startOf("day");
  const message=open
    ? force==="open"&&!scheduledOpen?"Ordering has been opened manually.":"Orders close at 11:59pm on Wednesday."
    : force==="closed"&&scheduledOpen?"Ordering has been paused manually.":"Orders are now closed for this week. The next menu launches Saturday at 12 noon.";

  return {
    open,week,message,
    windowStart:start.toISO()||"",
    windowEnd:end.toISO()||"",
    fulfilmentDate:fulfilment.toISODate()||""
  };
}

export function getMenuState(at=DateTime.now().setZone(ZONE)):MenuState{
  return buildMenuState(at,process.env.CYCLE_START_DATE||DEFAULT_ANCHOR,"auto");
}

export async function getRuntimeMenuState(at=DateTime.now().setZone(ZONE)):Promise<MenuState>{
  const runtime=await getRuntimeCommerceSettings();
  return buildMenuState(at,runtime.cycleStartDate,runtime.menuForceState);
}
