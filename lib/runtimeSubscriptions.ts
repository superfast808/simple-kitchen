import { getAdminSetting } from "./adminSettings";
import { subscriptionPlans,type SubscriptionCadence,type SubscriptionPlan } from "./subscriptionPlans";

export type RuntimeSubscriptionPlan=SubscriptionPlan&{enabled:boolean;public:boolean};

type Override={
  enabled?:boolean;
  public?:boolean;
  name?:string;
  description?:string;
  prices?:Record<string,number>;
};

export async function getRuntimeSubscriptionPlans():Promise<Record<SubscriptionCadence,RuntimeSubscriptionPlan>>{
  const overrides=await getAdminSetting<Record<string,Override>>("subscription_plan_overrides",{});
  const ids=["weekly","fortnightly","twice-weekly"] as SubscriptionCadence[];
  return Object.fromEntries(ids.map((id)=>{
    const base=subscriptionPlans[id];
    const override=overrides[id]||{};
    return [id,{
      ...base,
      enabled:override.enabled!==false,
      public:override.public===true||(id!=="twice-weekly"&&override.public!==false),
      name:override.name||base.name,
      description:override.description||base.description,
      options:base.options.map((option)=>{
        const price=override.prices?.[String(option.meals)];
        return Number.isFinite(Number(price))?{...option,pricePence:Math.max(0,Math.round(Number(price)))}:option;
      })
    }];
  })) as Record<SubscriptionCadence,RuntimeSubscriptionPlan>;
}

export async function getRuntimeSubscriptionPlan(id:string){
  const plans=await getRuntimeSubscriptionPlans();
  const key=(id==="fortnightly"||id==="twice-weekly"?id:"weekly") as SubscriptionCadence;
  return plans[key];
}
