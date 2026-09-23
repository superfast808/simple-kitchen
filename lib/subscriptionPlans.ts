export type SubscriptionCadence="weekly"|"fortnightly";

export type SubscriptionOption={
  meals:number;
  pricePence:number;
  wooVariationId:number;
};

export type SubscriptionPlan={
  id:SubscriptionCadence;
  name:string;
  description:string;
  intervalWeeks:1|2;
  wooProductId:number;
  options:SubscriptionOption[];
};

export const subscriptionPlans:Record<SubscriptionCadence,SubscriptionPlan>={
  weekly:{
    id:"weekly",
    name:"Weekly Meal Subscription",
    description:"Weekly meals on a subscription basis.",
    intervalWeeks:1,
    wooProductId:291,
    options:[
      { meals:4, pricePence:3100, wooVariationId:292 },
      { meals:5, pricePence:3875, wooVariationId:293 },
      { meals:6, pricePence:4650, wooVariationId:294 },
      { meals:7, pricePence:5425, wooVariationId:295 },
      { meals:8, pricePence:6200, wooVariationId:296 },
      { meals:9, pricePence:6975, wooVariationId:297 },
      { meals:10, pricePence:7750, wooVariationId:298 },
      { meals:11, pricePence:8525, wooVariationId:299 },
      { meals:12, pricePence:9300, wooVariationId:300 },
      { meals:13, pricePence:9750, wooVariationId:301 },
      { meals:14, pricePence:10500, wooVariationId:302 },
      { meals:15, pricePence:11625, wooVariationId:303 },
      { meals:16, pricePence:12000, wooVariationId:304 },
      { meals:17, pricePence:12750, wooVariationId:305 },
      { meals:18, pricePence:13500, wooVariationId:306 },
      { meals:19, pricePence:14250, wooVariationId:307 },
      { meals:20, pricePence:15000, wooVariationId:308 },
      { meals:21, pricePence:15750, wooVariationId:309 },
      { meals:22, pricePence:16500, wooVariationId:310 },
      { meals:23, pricePence:17250, wooVariationId:311 },
      { meals:24, pricePence:18000, wooVariationId:312 },
      { meals:25, pricePence:18750, wooVariationId:313 },
      { meals:26, pricePence:19500, wooVariationId:314 },
      { meals:27, pricePence:20250, wooVariationId:315 },
      { meals:28, pricePence:21000, wooVariationId:316 },
      { meals:29, pricePence:21750, wooVariationId:317 },
      { meals:30, pricePence:22500, wooVariationId:318 }
    ]
  },
  fortnightly:{
    id:"fortnightly",
    name:"Fortnightly Meal Subscription",
    description:"Fortnightly meals on a subscription basis.",
    intervalWeeks:2,
    wooProductId:764,
    options:[
      { meals:4, pricePence:3100, wooVariationId:765 },
      { meals:5, pricePence:3875, wooVariationId:766 },
      { meals:6, pricePence:4650, wooVariationId:767 },
      { meals:7, pricePence:5425, wooVariationId:768 },
      { meals:8, pricePence:6200, wooVariationId:769 },
      { meals:9, pricePence:6975, wooVariationId:770 },
      { meals:10, pricePence:7750, wooVariationId:771 },
      { meals:11, pricePence:8525, wooVariationId:772 },
      { meals:12, pricePence:9300, wooVariationId:773 },
      { meals:13, pricePence:10075, wooVariationId:774 },
      { meals:14, pricePence:10850, wooVariationId:775 },
      { meals:15, pricePence:11625, wooVariationId:776 },
      { meals:16, pricePence:12400, wooVariationId:777 },
      { meals:17, pricePence:13175, wooVariationId:778 },
      { meals:18, pricePence:13950, wooVariationId:779 },
      { meals:19, pricePence:14725, wooVariationId:780 },
      { meals:20, pricePence:15500, wooVariationId:781 },
      { meals:21, pricePence:16275, wooVariationId:782 },
      { meals:22, pricePence:17050, wooVariationId:783 },
      { meals:23, pricePence:17825, wooVariationId:784 },
      { meals:24, pricePence:18600, wooVariationId:785 },
      { meals:25, pricePence:18750, wooVariationId:786 },
      { meals:26, pricePence:19500, wooVariationId:787 },
      { meals:27, pricePence:20250, wooVariationId:788 },
      { meals:28, pricePence:21000, wooVariationId:789 },
      { meals:29, pricePence:21750, wooVariationId:790 },
      { meals:30, pricePence:22500, wooVariationId:791 }
    ]
  }
};

export function subscriptionPlan(id:string){
  return id==="fortnightly"?subscriptionPlans.fortnightly:subscriptionPlans.weekly;
}
