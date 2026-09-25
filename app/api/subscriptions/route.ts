import { NextRequest,NextResponse } from "next/server";
import { config } from "@/lib/config";
import { subscriptionPlan } from "@/lib/subscriptionPlans";
import { getStripe } from "@/lib/stripe";

export async function POST(request:NextRequest){
  try{
    const body=await request.json() as {plan?:string;meals:number;fulfilment:"delivery"|"collection";email:string;name:string};
    const plan=subscriptionPlan(body.plan||"weekly");
    const option=plan.options.find((item)=>item.meals===Number(body.meals));
    if(!option) return NextResponse.json({error:"Choose a valid subscription quantity."},{status:400});
    if(!body.email||!body.name) return NextResponse.json({error:"Name and email are required."},{status:400});
    if(!["delivery","collection"].includes(body.fulfilment)) return NextResponse.json({error:"Choose delivery or collection."},{status:400});

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

    if(body.fulfilment==="delivery"){
      line_items.push({
        quantity:1,
        price_data:{
          currency:"gbp",
          unit_amount:config.deliveryFeePence,
          recurring:{interval:"week" as const,interval_count:plan.intervalWeeks},
          product_data:{name:plan.intervalWeeks===1?"Weekly delivery":"Fortnightly delivery"}
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
        meals:String(option.meals),
        fulfilment:body.fulfilment,
        customerName:body.name,
        wooProductId:String(plan.wooProductId),
        wooVariationId:String(option.wooVariationId)
      }
    });
    return NextResponse.json({url:session.url});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to start subscription."},{status:500});
  }
}
