import { DateTime } from "luxon";
import { config } from "./config";
import { getAdminSetting } from "./adminSettings";

export async function givingIsActive(){
  const [enabled,start,end]=await Promise.all([
    getAdminSetting("giving_enabled",config.givingEnabled),
    getAdminSetting("giving_start",config.givingStart),
    getAdminSetting("giving_end",config.givingEnd)
  ]);
  if(!enabled) return false;
  const now=DateTime.now().setZone("Europe/London").toISODate()||"";
  return now>=String(start)&&now<=String(end);
}

export function roundUpDonationPence(amountPence:number){
  const remainder=((amountPence%100)+100)%100;
  return remainder===0?100:100-remainder;
}
