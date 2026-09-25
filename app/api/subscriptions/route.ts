import { NextRequest,NextResponse } from "next/server";
import { config } from "@/lib/config";
import { collectionAvailable,quoteDelivery } from "@/lib/fulfilment";
import { getRuntimeCommerceSettings } from "@/lib/runtimeConfig";
import { getRuntimeSubscriptionPlan } from "@/lib/runtimeSubscriptions";
import { getStripe } from "@/lib/stripe";

export async function POST(request:NextRequest){
  try{
    const body=await request.json() as {
      plan?:string;meals:number;fulfilment:"delivery"|"collection";email:string;name:string;
      address1?:string;address2?:string;city?:string;postcode?:string;
    };
    const [plan,runtime]=await Promise.all([
      getRuntimeSubscriptionPlan(body.plan||"weekly"),
      getRuntimeCommerceSettings()
    ]);
    if(!plan.enabled) return NextResponse.json({error:"This subscription plan is not currently available."},{status:409});
    const option=plan.options.find((item)=>item.meals===Number(body.meals));
    if(!option) return NextResponse.json({error:"Choose a valid subscription quantity."},{status:400});
    if(!body.email||!body.name) return NextResponse.json({error:"Name and email are required."},{status:400});
    if(!["delivery","collection"].includes(body.fulfilment)) return NextResponse.json({error:"Choose delivery or collection."},{status:400});

    let deliveryFeePence=0;
    let deliveryZone="";
    if(body.fulfilment==="collection"){
      if(!(await collectionAvailable())) return NextResponse.json({error:"Collection is currently unavailable."},{status:409});
    }else{
      if(!body.address1||!body.city||!body.postcode) return NextResponse.json({error:"A full delivery address and postcode are required."},{status:400});
      const quote=await quoteDelivery(body.postcode);
      if(!quote.allowed) return NextResponse.json({error:quote.reason},{status:400});
      if(option.pricePence<Math.max(runtime.minimumOrderPence,quote.minimumPence)){
        const minimum=Math.max(runtime.minimumOrderPence,quote.minimumPence);
        return NextResponse.json({error:"Minimum subscription value for "+(quote.zone?.name||"this area")+" is £"+(minimum/100).toFixed(2)+"."},{status:400});
      }
      deliveryFeePence=quote.feePence*plan.fulfilmentsPerCycle;
      deliveryZone=quote.zone?.name||"";
    }

    const stripe=await getStripe();
    const line_items=[{
      quantity:1,
      price_data:{
        currency:"gbp",
        unit_amount:option.pricePence,
        recurring:{interval:"week" as const,interval_count:plan.intervalWeeks},
        product_data:{name:option.meals+" Simple Kitchen meals — "+plan.name}
      }
    }];

    if(deliveryFeePence){
      line_items.push({
        quantity:1,
        price_data:{
          currency:"gbp",
          unit_amount:deliveryFeePence,
          recurring:{interval:"week" as const,interval_count:plan.intervalWeeks},
          product_data:{name:plan.fulfilmentsPerCycle===2?"Twice-weekly delivery":"Subscription delivery"}
        }
      });
    }

    const session=await stripe.checkout.sessions.create({
      mode:"subscription",
      line_items,
      customer_email:body.email,
      success_url:config.siteUrl+"/subscription-success",
      cancel_url:config.siteUrl+"/subscriptions",
      metadata:{
        type:"subscription",
        plan:plan.id,
        intervalWeeks:String(plan.intervalWeeks),
        fulfilmentsPerCycle:String(plan.fulfilmentsPerCycle),
        meals:String(option.meals),
        fulfilment:body.fulfilment,
        customerName:body.name,
        wooProductId:String(plan.wooProductId),
        wooVariationId:String(option.wooVariationId),
        address1:body.address1||"",
        address2:body.address2||"",
        city:body.city||"",
        postcode:body.postcode||"",
        deliveryZone,
        deliveryFeePence:String(deliveryFeePence)
      }
    });
    return NextResponse.json({url:session.url});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to start subscription."},{status:500});
  }
}
