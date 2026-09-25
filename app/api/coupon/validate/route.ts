import { NextRequest,NextResponse } from "next/server";
import { validateCoupon } from "@/lib/coupons";
import { getRuntimeProductById } from "@/lib/runtimeCatalog";

export async function POST(request:NextRequest){
  try{
    const body=await request.json() as {code?:string;email?:string;items?:{id:string;quantity:number}[]};
    if(!String(body.code||"").trim()) return NextResponse.json({error:"Enter a coupon code."},{status:400});
    if(!Array.isArray(body.items)||!body.items.length) return NextResponse.json({error:"Your basket is empty."},{status:400});

    const items=await Promise.all(body.items.map(async(item)=>{
      const product=await getRuntimeProductById(String(item.id||""));
      if(!product) throw new Error("A product in your basket is no longer available.");
      return {product,quantity:Math.max(1,Math.min(20,Math.floor(Number(item.quantity)||1)))};
    }));
    const subtotalPence=items.reduce((sum,item)=>sum+Math.round(item.product.price*100)*item.quantity,0);
    const coupon=await validateCoupon({
      code:String(body.code),
      items,
      email:String(body.email||""),
      subtotalPence
    });
    if(!coupon) return NextResponse.json({error:"Coupon is not valid."},{status:400});
    return NextResponse.json({
      ok:true,
      code:coupon.code,
      description:coupon.description,
      discountPence:coupon.discountPence,
      freeShipping:coupon.freeShipping,
      source:coupon.source
    });
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Coupon is not valid."},{status:400});
  }
}
