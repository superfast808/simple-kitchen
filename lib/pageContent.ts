import { getAdminSetting } from "./adminSettings";
import { site } from "./site";

export type HeroKey="home"|"order"|"subscriptions"|"story"|"find-us"|"checkout"|"account";
export type HeroConfig={
  eyebrow:string;
  title:string;
  copy:string;
  background:string;
  overlay:number;
  position:string;
  primaryLabel?:string;
  primaryHref?:string;
  secondaryLabel?:string;
  secondaryHref?:string;
};

export const heroDefaults:Record<HeroKey,HeroConfig>={
  home:{
    eyebrow:"Freshly prepared every week",
    title:"Meals made simple",
    copy:"Chef prepared meals delivered weekly. Proper food, full of flavour, ready when you are.",
    background:site.heroBackground,overlay:0.18,position:"center center",
    primaryLabel:"Order Now",primaryHref:"/order",secondaryLabel:"Browse Menu",secondaryHref:"/order"
  },
  order:{
    eyebrow:"Our menu",title:"Order Here",
    copy:"Simply order before Wednesday midnight to secure your order for Saturday coming. At checkout choose collection or delivery, subject to coverage.",
    background:"",overlay:0.18,position:"center center"
  },
  subscriptions:{
    eyebrow:"Meal subscriptions",title:"Subscriptions",
    copy:"Choose the subscription rhythm that suits you, then select your meals from each live menu.",
    background:"",overlay:0.18,position:"center center"
  },
  story:{eyebrow:"Simple Kitchen",title:"Our Story",copy:"",background:"",overlay:0.18,position:"center center"},
  "find-us":{
    eyebrow:"Stockists",title:"Where to find us",
    copy:"Find Simple Kitchen meals at a growing number of locations across Glasgow and the west of Scotland.",
    background:"",overlay:0.18,position:"center center"
  },
  checkout:{eyebrow:"Secure checkout",title:"Checkout",copy:"",background:"",overlay:0.18,position:"center center"},
  account:{eyebrow:"Customer account",title:"Your Simple Kitchen account",copy:"",background:"",overlay:0.18,position:"center center"}
};

export async function getHeroConfig(key:HeroKey):Promise<HeroConfig>{
  const overrides=await getAdminSetting<Partial<Record<HeroKey,Partial<HeroConfig>>>>("page_heroes",{});
  const override=overrides[key]||{};
  return {...heroDefaults[key],...override};
}

export async function getAllHeroConfigs(){
  const overrides=await getAdminSetting<Partial<Record<HeroKey,Partial<HeroConfig>>>>("page_heroes",{});
  return Object.fromEntries((Object.keys(heroDefaults) as HeroKey[]).map((key)=>[
    key,{...heroDefaults[key],...(overrides[key]||{})}
  ])) as Record<HeroKey,HeroConfig>;
}
