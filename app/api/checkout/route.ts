import { NextRequest,NextResponse } from "next/server";
import Stripe from "stripe";
import { config } from "@/lib/config";
import { validateCoupon } from "@/lib/coupons";
import { getRuntimeMenuState } from "@/lib/cycle";
import { givingIsActive,roundUpDonationPence } from "@/lib/giving";
import { collectionAvailable,quoteDelivery } from "@/lib/fulfilment";
import { attachStripeSession,CapacityError,markOrderStatus,reserveOrder } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { getRuntimeCommerceSettings } from "@/lib/runtimeConfig";
import { getRuntimeProductById } from "@/lib/runtimeCatalog";
import type { Fulfilment } from "@/lib/types";

type Body={
  items:{id:string;quantity:number}[];
  fulfilment?:"delivery"|"collection";
  roundup?:boolean;
  couponCode?:string;
  giftRecipientName?:string;
  giftRecipientEmail?:string;
  giftMessage?:string;
  customer:{name:string;email:string;phone:string;address1?:string;address2?:string;city?:string;postcode?:string};
};

export async function POST(request:NextRequest){
  let orderId="";
  try{
    const body=await request.json() as Body;
    const [state,runtime]=await Promise.all([getRuntimeMenuState(),getRuntimeCommerceSettings()]);
    if(!Array.isArray(body.items)||body.items.length===0) return NextResponse.json({error:"Your basket is empty."},{status:400});
    if(!body.customer?.name||!body.customer?.email) return NextResponse.json({error:"Name and email are required."},{status:400});

    const resolved=await Promise.all(body.items.map(async(item)=>{
      const product=await getRuntimeProductById(item.id);
      const quantity=Math.max(1,Math.min(20,Math.floor(Number(item.quantity)||1));
      if(!product) throw new Error("A product in your basket is no longer available.");
      if(product.weeks!=="always"&&(!state.open||!product.weeks.includes(state.week))) throw new Error(product.name+" is not available in the current menu window.");
      return {product,quantity};
    }));

    const physicalItems=resolved.filter((item)=>item.product.category!=="gift");
    const giftItems=resolved.filter((item)=>item.product.category==="gift");
    const giftOnly=physicalItems.length===0&&giftItems.length>0;
    const fulfilment:Fulfilment=giftOnly?"electronic":body.fulfilment==="delivery"?"delivery":"collection";

    if(!giftOnly&&!["delivery","collection"].includes(String(body.fulfilment||""))){
      return NextResponse.json({error:"Choose delivery or collection."},{status:400});
    }
    if(fulfilment==="collection"&&!(await collectionAvailable())){
      return NextResponse.json({error:"Collection is currently unavailable."},{status:400});
    }
    if(fulfilment==="delivery"&&(!body.customer.address1||!body.customer.postcode)){
      return NextResponse.json({error:"A delivery address and postcode are required."},{status:400});
    }

    if(giftItems.length){
      const recipientEmail=(body.giftRecipientEmail||body.customer.email||"").trim();
      if(!recipientEmail||!recipientEmail.includes("@")) return NextResponse.json({error:"Enter a valid gift-card recipient email address."},{status:400});
      body.customer={
        ...body.customer,
        giftRecipientName:String(body.giftRecipientName||body.customer.name||"").slice(0,120),
        giftRecipientEmail:recipientEmail.slice(0,254),
        giftMessage:String(body.giftMessage||"").slice(0,800)
      };
    }

    const subtotalPence=resolved.reduce((sum,item)=>sum+Math.round(item.product.price*100)*item.quantity,0);
    const physicalSubtotalPence=physicalItems.reduce((sum,item)=>sum+Math.round(item.product.price*100)*item.quantity,0);

    if(physicalItems.length&&physicalSubtotalPence<runtime.minimumOrderPence){
      return NextResponse.json({error:"Minimum meal order is £"+(runtime.minimumOrderPence/100).toFixed(2)+"."},{status:400});
    }

    let shippingPence=0;
    if(fulfilment==="delivery"){
      const quote=await quoteDelivery(body.customer.postcode||"",physicalSubtotalPence);
      if(!quote.allowed) return NextResponse.json({error:quote.reason},{status:400});
      const minimumPence=Math.max(runtime.minimumOrderPence,quote.minimumPence);
      if(physicalSubtotalPence<minimumPence){
        return NextResponse.json({error:"Minimum meal order for "+(quote.zone?.name||"this delivery area")+" is £"+(minimumPence/100).toFixed(2)+"."},{status:400});
      }
      shippingPence=quote.feePence;
    }

    let coupon:null|Awaited<ReturnType<typeof validateCoupon>>=null;
    if(String(body.couponCode||"").trim()){
      try{
        coupon=await validateCoupon({
          code:String(body.couponCode),
          items:resolved,
          email:body.customer.email,
          subtotalPence
        });
      }catch(error){
        return NextResponse.json({error:error instanceof Error?error.message:"Coupon is not valid."},{status:400});
      }
    }
    if(coupon?.freeShipping&&fulfilment==="delivery") shippingPence=0;
    const discountPence=coupon?.discountPence||0;

    const preDonationTotal=Math.max(0,subtotalPence+shippingPence-discountPence);
    const donationPence=body.roundup&&(await givingIsActive())?roundUpDonationPence(preDonationTotal):0;

    orderId=await reserveOrder({
      cycleKey:state.windowStart.slice(0,10),
      fulfilmentDate:state.fulfilmentDate,
      fulfilment,
      items:resolved,
      subtotalPence,shippingPence,donationPence,discountPence,
      couponId:coupon?.id||null,couponCode:coupon?.code||null,
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

    let discounts:Stripe.Checkout.SessionCreateParams.Discount[]|undefined;
    if(discountPence>0&&coupon){
      const stripeCoupon=await stripe.coupons.create({
        duration:"once",
        amount_off:discountPence,
        currency:"gbp",
        name:"Simple Kitchen "+coupon.code,
        metadata:{sourceCouponId:coupon.id,code:coupon.code,orderId}
      });
      discounts=[{coupon:stripeCoupon.id}];
    }

    const session=await stripe.checkout.sessions.create({
      mode:"payment",
      line_items,
      ...(discounts?{discounts}:{}),
      customer_email:body.customer.email,
      success_url:config.siteUrl+"/order-success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url:config.siteUrl+"/checkout?cancelled=1",
      metadata:{
        orderId,
        fulfilment,
        couponCode:coupon?.code||"",
        giftRecipientEmail:String(body.customer.giftRecipientEmail||"").slice(0,250)
      },
      ...(fulfilment==="delivery"?{shipping_address_collection:{allowed_countries:["GB" as const]}}:{})
    });
    await attachStripeSession(orderId,session.id);
    return NextResponse.json({
      url:session.url,
      discountPence,
      couponCode:coupon?.code||null,
      fulfilment
    });
  }catch(error){
    if(orderId) await markOrderStatus(orderId,"failed").catch(()=>undefined);
    const message=error instanceof Error?error.message:"Unable to start checkout.";
    return NextResponse.json({error:message},{status:error instanceof CapacityError?409:500});
  }
}
