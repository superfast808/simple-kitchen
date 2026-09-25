import { NextRequest,NextResponse } from "next/server";
import Stripe from "stripe";
import { config } from "@/lib/config";
import { getRuntimeMenuState } from "@/lib/cycle";
import { givingIsActive,roundUpDonationPence } from "@/lib/giving";
import { collectionAvailable,quoteDelivery } from "@/lib/fulfilment";
import { attachStripeSession,CapacityError,markOrderStatus,reserveOrder } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { getRuntimeCommerceSettings } from "@/lib/runtimeConfig";
import { getRuntimeProductById } from "@/lib/runtimeCatalog";

type Body={
  items:{id:string;quantity:number}[];
  fulfilment:"delivery"|"collection";
  roundup?:boolean;
  customer:{name:string;email:string;phone:string;address1?:string;address2?:string;city?:string;postcode?:string};
};

export async function POST(request:NextRequest){
  let orderId="";
  try{
    const body=await request.json() as Body;
    const [state,runtime]=await Promise.all([getRuntimeMenuState(),getRuntimeCommerceSettings()]);
    if(!Array.isArray(body.items)||body.items.length===0) return NextResponse.json({error:"Your basket is empty."},{status:400});
    if(!["delivery","collection"].includes(body.fulfilment)) return NextResponse.json({error:"Choose delivery or collection."},{status:400});
    if(body.fulfilment==="collection"&&!(await collectionAvailable())) return NextResponse.json({error:"Collection is currently unavailable."},{status:400});
    if(!body.customer?.name||!body.customer?.email) return NextResponse.json({error:"Name and email are required."},{status:400});
    if(body.fulfilment==="delivery"&&(!body.customer.address1||!body.customer.postcode)) return NextResponse.json({error:"A delivery address and postcode are required."},{status:400});

    const resolved=await Promise.all(body.items.map(async(item)=>{
      const product=await getRuntimeProductById(item.id);
      const quantity=Math.max(1,Math.min(20,Math.floor(Number(item.quantity)||1)));
      if(!product) throw new Error("A product in your basket is no longer available.");
      if(product.weeks!=="always"&&(!state.open||!product.weeks.includes(state.week))) throw new Error(product.name+" is not available in the current menu window.");
      return {product,quantity};
    }));

    const subtotalPence=resolved.reduce((sum,item)=>sum+Math.round(item.product.price*100)*item.quantity,0);
    if(subtotalPence<runtime.minimumOrderPence){
      return NextResponse.json({error:"Minimum order is £"+(runtime.minimumOrderPence/100).toFixed(2)+"."},{status:400});
    }

    let shippingPence=0;
    if(body.fulfilment==="delivery"){
      const quote=await quoteDelivery(body.customer.postcode||"");
      if(!quote.allowed) return NextResponse.json({error:quote.reason},{status:400});
      const minimumPence=Math.max(runtime.minimumOrderPence,quote.minimumPence);
      if(subtotalPence<minimumPence){
        return NextResponse.json({error:"Minimum order for "+(quote.zone?.name||"this delivery area")+" is £"+(minimumPence/100).toFixed(2)+"."},{status:400});
      }
      shippingPence=quote.feePence;
    }

    const donationPence=body.roundup&&(await givingIsActive())?roundUpDonationPence(subtotalPence+shippingPence):0;

    orderId=await reserveOrder({
      cycleKey:state.windowStart.slice(0,10),
      fulfilmentDate:state.fulfilmentDate,
      fulfilment:body.fulfilment,
      items:resolved,
      subtotalPence,shippingPence,donationPence,
      customer:body.customer
    });

    const stripe=await getStripe();
    const line_items:Stripe.Checkout.SessionCreateParams.LineItem[]=resolved.map(({product,quantity})=>({
      quantity,
      price_data:{
        currency:"gbp",
        unit_amount:Math.round(product.price*100),
        product_data:{name:product.name,description:product.description.slice(0,180)}
      }
    }));
    if(shippingPence) line_items.push({quantity:1,price_data:{currency:"gbp",unit_amount:shippingPence,product_data:{name:"Delivery"}}});
    if(donationPence) line_items.push({quantity:1,price_data:{currency:"gbp",unit_amount:donationPence,product_data:{name:"Christmas Giving donation"}}});

    const session=await stripe.checkout.sessions.create({
      mode:"payment",
      line_items,
      customer_email:body.customer.email,
      success_url:config.siteUrl+"/order-success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url:config.siteUrl+"/checkout?cancelled=1",
      metadata:{orderId,fulfilment:body.fulfilment},
      ...(body.fulfilment==="delivery"?{shipping_address_collection:{allowed_countries:["GB" as const]}}:{})
    });
    await attachStripeSession(orderId,session.id);
    return NextResponse.json({url:session.url});
  }catch(error){
    if(orderId) await markOrderStatus(orderId,"failed").catch(()=>undefined);
    const message=error instanceof Error?error.message:"Unable to start checkout.";
    return NextResponse.json({error:message},{status:error instanceof CapacityError?409:500});
  }
}
