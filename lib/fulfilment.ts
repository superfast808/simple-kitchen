import { config } from "./config";
import { getRuntimeCommerceSettings } from "./runtimeConfig";

export type DeliveryZoneRule={
  id:string;
  name:string;
  prefixes:string[];
  feePence:number;
  minimumPence:number;
  enabled:boolean;
};

function normalisePostcode(value:string){
  return value.toUpperCase().replace(/[^A-Z0-9]/g,"");
}

function parseZoneRows(rows:unknown[],defaultFee:number,defaultMinimum:number):DeliveryZoneRule[]{
  return rows.map((raw,index)=>{
    const zone=(raw||{}) as Record<string,unknown>;
    return {
      id:String(zone.id||"zone-"+(index+1)),
      name:String(zone.name||"Delivery area"),
      prefixes:Array.isArray(zone.prefixes)?zone.prefixes.map((p)=>normalisePostcode(String(p))):[],
      feePence:Number.isFinite(Number(zone.feePence))?Math.max(0,Math.round(Number(zone.feePence))):defaultFee,
      minimumPence:Number.isFinite(Number(zone.minimumPence))?Math.max(0,Math.round(Number(zone.minimumPence))):defaultMinimum,
      enabled:zone.enabled!==false
    };
  }).filter((zone)=>zone.prefixes.length>0);
}

function envZones(){
  const raw=process.env.DELIVERY_ZONES_JSON?.trim();
  if(!raw) return [];
  try{return Array.isArray(JSON.parse(raw))?JSON.parse(raw):[];}catch{return [];}
}

export async function deliveryZones(){
  const runtime=await getRuntimeCommerceSettings();
  const source=runtime.deliveryZones.length?runtime.deliveryZones:envZones();
  return parseZoneRows(source,runtime.deliveryFeePence,runtime.minimumOrderPence);
}

export async function quoteDelivery(postcode:string){
  const runtime=await getRuntimeCommerceSettings();
  if(!runtime.deliveryEnabled){
    return {allowed:false,reason:"Delivery is currently unavailable.",zone:null,feePence:0,minimumPence:0};
  }
  const compact=normalisePostcode(postcode||"");
  if(compact.length<5){
    return {allowed:false,reason:"Enter a valid postcode to check delivery.",zone:null,feePence:0,minimumPence:0};
  }

  const zones=await deliveryZones();
  const match=zones.find((zone)=>zone.enabled&&zone.prefixes.some((prefix)=>compact.startsWith(prefix)));
  if(match){
    return {allowed:true,reason:"",zone:{id:match.id,name:match.name},feePence:match.feePence,minimumPence:match.minimumPence};
  }

  if(zones.length===0&&!runtime.deliveryRequireZoneMatch){
    return {
      allowed:true,
      reason:"",
      zone:{id:"default",name:"Standard delivery"},
      feePence:runtime.deliveryFeePence,
      minimumPence:runtime.minimumOrderPence
    };
  }

  return {
    allowed:false,
    reason:"Sorry, this postcode is outside our current delivery area. Collection is still available.",
    zone:null,
    feePence:0,
    minimumPence:0
  };
}

export async function collectionAvailable(){
  const runtime=await getRuntimeCommerceSettings();
  return runtime.collectionEnabled;
}

export { normalisePostcode };
