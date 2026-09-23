import { config } from "./config";

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

function parseZones():DeliveryZoneRule[]{
  const raw=process.env.DELIVERY_ZONES_JSON?.trim();
  if(!raw) return [];
  try{
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)) return [];
    return parsed.map((zone,index)=>({
      id:String(zone.id||"zone-"+(index+1)),
      name:String(zone.name||"Delivery area"),
      prefixes:Array.isArray(zone.prefixes)?zone.prefixes.map((p:unknown)=>normalisePostcode(String(p))):[],
      feePence:Number.isFinite(Number(zone.feePence))?Math.max(0,Math.round(Number(zone.feePence))):config.deliveryFeePence,
      minimumPence:Number.isFinite(Number(zone.minimumPence))?Math.max(0,Math.round(Number(zone.minimumPence))):config.minimumOrderPence,
      enabled:zone.enabled!==false
    })).filter((zone)=>zone.prefixes.length>0);
  }catch{
    return [];
  }
}

export function deliveryZones(){
  return parseZones();
}

export function quoteDelivery(postcode:string){
  if(!config.deliveryEnabled){
    return {allowed:false,reason:"Delivery is currently unavailable.",zone:null,feePence:0,minimumPence:0};
  }
  const compact=normalisePostcode(postcode||"");
  if(compact.length<5){
    return {allowed:false,reason:"Enter a valid postcode to check delivery.",zone:null,feePence:0,minimumPence:0};
  }

  const zones=deliveryZones();
  const match=zones.find((zone)=>zone.enabled&&zone.prefixes.some((prefix)=>compact.startsWith(prefix)));
  if(match){
    return {allowed:true,reason:"",zone:{id:match.id,name:match.name},feePence:match.feePence,minimumPence:match.minimumPence};
  }

  if(zones.length===0&&!config.deliveryRequireZoneMatch){
    return {
      allowed:true,
      reason:"",
      zone:{id:"default",name:"Standard delivery"},
      feePence:config.deliveryFeePence,
      minimumPence:config.minimumOrderPence
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

export function collectionAvailable(){
  return config.collectionEnabled;
}
