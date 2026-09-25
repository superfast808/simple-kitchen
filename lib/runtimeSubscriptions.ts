import { getAdminSetting } from "./adminSettings";
import { subscriptionPlans,type SubscriptionCadence,type SubscriptionOption,type SubscriptionPlan } from "./subscriptionPlans";

export type RuntimeSubscriptionPlan=SubscriptionPlan&{enabled:boolean;public:boolean};

type Override={
  enabled?:boolean;
  public?:boolean;
  name?:string;
  description?:string;
  wooProductId?:number;
  intervalWeeks?:1|2;
  fulfilmentsPerCycle?:1|2;
  options?:SubscriptionOption[];
  prices?:Record<string,number>;
};

function cleanOptions(options:SubscriptionOption[]){
  return options
    .map((option)=>({
      meals:Math.max(1,Math.min(60,Math.round(Number(option.meals)||0))),
      pricePence:Math.max(0,Math.round(Number(option.pricePence)||0)),
      wooVariationId:Math.max(0,Math.round(Number(option.wooVariationId)||0)),
      enabled:option.enabled!==false
    }))
    .filter((option)=>option.meals>0)
    .sort((a,b)=>a.meals-b.meals);
}

export async function getRuntimeSubscriptionPlans():Promise<Record<SubscriptionCadence,RuntimeSubscriptionPlan>>{
  const overrides=await getAdminSetting<Record<string,Override>>("subscription_plan_overrides",{});
  const ids=["weekly","fortnightly","twice-weekly"] as SubscriptionCadence[];
  return Object.fromEntries(ids.map((id)=>{
    const base=subscriptionPlans[id];
    const override=overrides[id]||{};
    const legacyOptions=base.options.map((option)=>{
      const price=override.prices?.[String(option.meals)];
      return Number.isFinite(Number(price))
        ? {...option,pricePence:Math.max(0,Math.round(Number(price))),enabled:true}
        : {...option,enabled:true};
    });
    const options=Array.isArray(override.options)&&override.options.length?cleanOptions(override.options):legacyOptions;
    return [id,{
      ...base,
      enabled:override.enabled!==false,
      public:override.public===true||(id!=="twice-weekly"&&override.public!==false),
      name:override.name||base.name,
      description:override.description||base.description,
      wooProductId:Number.isFinite(Number(override.wooProductId))?Number(override.wooProductId):base.wooProductId,
      intervalWeeks:override.intervalWeeks===2?2:override.intervalWeeks===1?1:base.intervalWeeks,
      fulfilmentsPerCycle:override.fulfilmentsPerCycle===2?2:override.fulfilmentsPerCycle===1?1:base.fulfilmentsPerCycle,
      options
    }];
  })) as Record<SubscriptionCadence,RuntimeSubscriptionPlan>;
}

export async function getRuntimeSubscriptionPlan(id:string){
  const plans=await getRuntimeSubscriptionPlans();
  const key=(id==="fortnightly"||id==="twice-weekly"?id:"weekly") as SubscriptionCadence;
  return plans[key];
}
