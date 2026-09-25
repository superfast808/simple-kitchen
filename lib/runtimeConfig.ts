import { db } from "./db";
import { config } from "./config";

export type RuntimeCommerceSettings={
  weeklyItemCap:number;
  deliverySlotCap:number;
  deliveryFeePence:number;
  minimumOrderPence:number;
  deliveryEnabled:boolean;
  collectionEnabled:boolean;
  deliveryRequireZoneMatch:boolean;
  deliveryZones:unknown[];
  cycleStartDate:string;
  menuForceState:"auto"|"open"|"closed";
  menuOpenDay:number;
  menuOpenHour:number;
  menuOpenMinute:number;
  menuCloseDay:number;
  menuCloseHour:number;
  menuCloseMinute:number;
  fulfilmentOffsetDays:number;
};

function num(value:unknown,fallback:number){
  const parsed=Number(value);
  return Number.isFinite(parsed)?Math.round(parsed):fallback;
}
function bool(value:unknown,fallback:boolean){
  return typeof value==="boolean"?value:fallback;
}
function clamp(value:number,min:number,max:number){return Math.min(max,Math.max(min,value));}

export async function getRuntimeCommerceSettings():Promise<RuntimeCommerceSettings>{
  const defaults:RuntimeCommerceSettings={
    weeklyItemCap:config.weeklyItemCap,
    deliverySlotCap:config.deliverySlotCap,
    deliveryFeePence:config.deliveryFeePence,
    minimumOrderPence:config.minimumOrderPence,
    deliveryEnabled:config.deliveryEnabled,
    collectionEnabled:config.collectionEnabled,
    deliveryRequireZoneMatch:config.deliveryRequireZoneMatch,
    deliveryZones:[],
    cycleStartDate:process.env.CYCLE_START_DATE||"2025-03-15",
    menuForceState:"auto",
    menuOpenDay:6,
    menuOpenHour:12,
    menuOpenMinute:0,
    menuCloseDay:3,
    menuCloseHour:23,
    menuCloseMinute:59,
    fulfilmentOffsetDays:7
  };
  try{
    const keys=[
      "weekly_item_cap","delivery_slot_cap","delivery_fee_pence","minimum_order_pence",
      "delivery_enabled","collection_enabled","delivery_require_zone_match","delivery_zones",
      "cycle_start_date","menu_force_state","menu_open_day","menu_open_hour","menu_open_minute",
      "menu_close_day","menu_close_hour","menu_close_minute","fulfilment_offset_days"
    ];
    const result=await db().query("SELECT key,value FROM admin_settings WHERE is_secret=false AND key=ANY($1::text[])",[keys]);
    const values=Object.fromEntries(result.rows.map((row)=>[row.key,row.value]));
    const force=values.menu_force_state;
    return {
      weeklyItemCap:num(values.weekly_item_cap,defaults.weeklyItemCap),
      deliverySlotCap:num(values.delivery_slot_cap,defaults.deliverySlotCap),
      deliveryFeePence:num(values.delivery_fee_pence,defaults.deliveryFeePence),
      minimumOrderPence:num(values.minimum_order_pence,defaults.minimumOrderPence),
      deliveryEnabled:bool(values.delivery_enabled,defaults.deliveryEnabled),
      collectionEnabled:bool(values.collection_enabled,defaults.collectionEnabled),
      deliveryRequireZoneMatch:bool(values.delivery_require_zone_match,defaults.deliveryRequireZoneMatch),
      deliveryZones:Array.isArray(values.delivery_zones)?values.delivery_zones:defaults.deliveryZones,
      cycleStartDate:typeof values.cycle_start_date==="string"?values.cycle_start_date:defaults.cycleStartDate,
      menuForceState:force==="open"||force==="closed"?force:"auto",
      menuOpenDay:clamp(num(values.menu_open_day,defaults.menuOpenDay),1,7),
      menuOpenHour:clamp(num(values.menu_open_hour,defaults.menuOpenHour),0,23),
      menuOpenMinute:clamp(num(values.menu_open_minute,defaults.menuOpenMinute),0,59),
      menuCloseDay:clamp(num(values.menu_close_day,defaults.menuCloseDay),1,7),
      menuCloseHour:clamp(num(values.menu_close_hour,defaults.menuCloseHour),0,23),
      menuCloseMinute:clamp(num(values.menu_close_minute,defaults.menuCloseMinute),0,59),
      fulfilmentOffsetDays:clamp(num(values.fulfilment_offset_days,defaults.fulfilmentOffsetDays),0,21)
    };
  }catch{
    return defaults;
  }
}
