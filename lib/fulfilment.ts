import { getRuntimeCommerceSettings } from "./runtimeConfig";
import { wooShippingSeed } from "./wooShippingSeed";

export type ShippingZoneRule={
  id:string;
  name:string;
  patterns:string[];
  deliveryEnabled:boolean;
  collectionEnabled:boolean;
  feePence:number;
  minimumPence:number;
  freeDeliveryMinimumPence:number|null;
};

function normalisePostcode(value:string){
  return value.toUpperCase().replace(/[^A-Z0-9]/g,"");
}

function normalisePattern(value:string){
  return value.toUpperCase().replace(/\s+/g,"").replace(/[^A-Z0-9*]/g,"");
}

function postcodeMatchesPattern(postcode:string,pattern:string){
  const compact=normalisePostcode(postcode);
  const cleaned=normalisePattern(pattern);
  if(!cleaned) return false;
  if(cleaned.endsWith("*")) return compact.startsWith(cleaned.slice(0,-1));
  return compact===cleaned;
}

function parseZoneRows(rows:unknown[],defaultFee:number,defaultMinimum:number):ShippingZoneRule[]{
  return rows.map((raw,index)=>{
    const zone=(raw||{}) as Record<string,unknown>;
    const legacyPrefixes=Array.isArray(zone.prefixes)?zone.prefixes:[];
    const patterns=Array.isArray(zone.patterns)?zone.patterns:legacyPrefixes;
    const freeRaw=zone.freeDeliveryMinimumPence;
    return {
      id:String(zone.id||"zone-"+(index+1)),
      name:String(zone.name||"Shipping zone"),
      patterns:patterns.map((p)=>normalisePattern(String(p))).filter(Boolean),
      deliveryEnabled:zone.deliveryEnabled===true,
      collectionEnabled:zone.collectionEnabled!==false,
      feePence:Number.isFinite(Number(zone.feePence))?Math.max(0,Math.round(Number(zone.feePence))):defaultFee,
      minimumPence:Number.isFinite(Number(zone.minimumPence))?Math.max(0,Math.round(Number(zone.minimumPence))):defaultMinimum,
      freeDeliveryMinimumPence:freeRaw==null||freeRaw===""?null:Math.max(0,Math.round(Number(freeRaw)||0))
    };
  });
}

function seedZones(defaultFee:number,defaultMinimum:number):ShippingZoneRule[]{
  return wooShippingSeed.map((zone)=>({
    ...zone,
    feePence:zone.feePence??defaultFee,
    minimumPence:zone.minimumPence??defaultMinimum
  }));
}

export async function shippingZones(){
  const runtime=await getRuntimeCommerceSettings();
  if(runtime.deliveryZones.length) return parseZoneRows(runtime.deliveryZones,runtime.deliveryFeePence,runtime.minimumOrderPence);
  return seedZones(runtime.deliveryFeePence,runtime.minimumOrderPence);
}

export async function matchShippingZone(postcode:string){
  const compact=normalisePostcode(postcode||"");
  if(compact.length<5) return null;
  const zones=await shippingZones();
  for(const zone of zones){
    if(zone.patterns.length===0) continue;
    if(zone.patterns.some((pattern)=>postcodeMatchesPattern(compact,pattern))) return zone;
  }
  return zones.find((zone)=>zone.patterns.length===0)||null;
}

export async function quoteDelivery(postcode:string,subtotalPence=0){
  const runtime=await getRuntimeCommerceSettings();
  if(!runtime.deliveryEnabled){
    return {allowed:false,reason:"Delivery is currently unavailable.",zone:null,feePence:0,minimumPence:0};
  }

  const compact=normalisePostcode(postcode||"");
  if(compact.length<5){
    return {allowed:false,reason:"Enter a valid postcode to check delivery.",zone:null,feePence:0,minimumPence:0};
  }

  const zone=await matchShippingZone(compact);
  if(!zone||!zone.deliveryEnabled){
    return {
      allowed:false,
      reason:"Sorry, delivery is not available to this postcode. Collection is still available.",
      zone:zone?{id:zone.id,name:zone.name}:null,
      feePence:0,
      minimumPence:0
    };
  }

  const free=zone.freeDeliveryMinimumPence!=null&&subtotalPence>=zone.freeDeliveryMinimumPence;
  return {
    allowed:true,
    reason:"",
    zone:{id:zone.id,name:zone.name},
    feePence:free?0:zone.feePence,
    minimumPence:zone.minimumPence,
    freeDeliveryMinimumPence:zone.freeDeliveryMinimumPence
  };
}

export async function collectionAvailable(){
  const runtime=await getRuntimeCommerceSettings();
  return runtime.collectionEnabled;
}

export { normalisePostcode,postcodeMatchesPattern };
