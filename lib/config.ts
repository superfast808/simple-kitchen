const money=(value:string|undefined,fallback:number)=>{
  const parsed=Number(value);
  return Number.isFinite(parsed)?Math.round(parsed*100):Math.round(fallback*100);
};
const integer=(value:string|undefined,fallback:number)=>{
  const parsed=Number.parseInt(value||"",10);
  return Number.isFinite(parsed)?parsed:fallback;
};
const flag=(value:string|undefined,fallback:boolean)=>{
  if(value==null||value==="") return fallback;
  return value.toLowerCase()==="true";
};

export const config={
  siteUrl:(process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000").replace(/\/$/,""),
  weeklyItemCap:integer(process.env.WEEKLY_ITEM_CAP,200),
  deliverySlotCap:integer(process.env.DELIVERY_SLOT_CAP,75),
  deliveryFeePence:money(process.env.DELIVERY_FEE,3),
  minimumOrderPence:money(process.env.MINIMUM_ORDER_AMOUNT,0),
  deliveryEnabled:flag(process.env.DELIVERY_ENABLED,true),
  collectionEnabled:flag(process.env.COLLECTION_ENABLED,true),
  deliveryRequireZoneMatch:flag(process.env.DELIVERY_REQUIRE_ZONE_MATCH,false),
  givingEnabled:process.env.CHRISTMAS_GIVING_ENABLED==="true",
  givingStart:process.env.GIVING_START||"2026-11-01",
  givingEnd:process.env.GIVING_END||"2026-12-24"
};
