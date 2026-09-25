"use client";
import { FormEvent,useEffect,useMemo,useState } from "react";
import { useCart } from "./CartProvider";

const fallbackMinimum=Number(process.env.NEXT_PUBLIC_MINIMUM_ORDER_AMOUNT||0);

type DeliveryQuote={
  allowed:boolean;
  reason:string;
  zone:{id:string;name:string}|null;
  feePence:number;
  minimumPence:number;
};

type CouponPreview={
  code:string;
  description:string;
  discountPence:number;
  freeShipping:boolean;
  source:string;
};

export function CheckoutClient(){
  const {items,subtotal}=useCart();
  const [fulfilment,setFulfilment]=useState<"collection"|"delivery">("collection");
  const [roundup,setRoundup]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [postcode,setPostcode]=useState("");
  const [email,setEmail]=useState("");
  const [checkingPostcode,setCheckingPostcode]=useState(false);
  const [deliveryQuote,setDeliveryQuote]=useState<DeliveryQuote|null>(null);
  const [collectionAllowed,setCollectionAllowed]=useState(true);
  const [capacity,setCapacity]=useState<{deliveryRemaining:number;weeklyRemaining:number}|null>(null);
  const [couponCode,setCouponCode]=useState("");
  const [coupon,setCoupon]=useState<CouponPreview|null>(null);
  const [couponBusy,setCouponBusy]=useState(false);
  const [couponMessage,setCouponMessage]=useState("");

  const hasGift=items.some((item)=>item.product.category==="gift");
  const giftOnly=items.length>0&&items.every((item)=>item.product.category==="gift");
  const physicalSubtotal=items.filter((item)=>item.product.category!=="gift").reduce((sum,item)=>sum+item.product.price*item.quantity,0);

  useEffect(()=>{
    fetch("/api/capacity").then((r)=>r.json()).then(setCapacity).catch(()=>undefined);
    fetch("/api/fulfilment").then((r)=>r.json()).then((data)=>setCollectionAllowed(data.collection?.allowed!==false)).catch(()=>undefined);
  },[]);

  useEffect(()=>{
    if(giftOnly||fulfilment!=="delivery"){
      setCheckingPostcode(false);
      return;
    }
    const trimmed=postcode.trim();
    if(trimmed.length<5){
      setDeliveryQuote(null);
      return;
    }
    setCheckingPostcode(true);
    const timer=window.setTimeout(()=>{
      fetch("/api/fulfilment?postcode="+encodeURIComponent(trimmed)+"&subtotalPence="+Math.round(physicalSubtotal*100))
        .then((r)=>r.json())
        .then((data)=>setDeliveryQuote(data.delivery||null))
        .catch(()=>setDeliveryQuote({allowed:false,reason:"Unable to check this postcode right now.",zone:null,feePence:0,minimumPence:0}))
        .finally(()=>setCheckingPostcode(false));
    },350);
    return()=>window.clearTimeout(timer);
  },[postcode,fulfilment,giftOnly,physicalSubtotal]);

  useEffect(()=>{
    setCoupon(null);
    setCouponMessage("");
  },[items,email]);

  const quotedShipping=giftOnly?0:(fulfilment==="delivery"&&deliveryQuote?.allowed?deliveryQuote.feePence/100:0);
  const shipping=coupon?.freeShipping?0:quotedShipping;
  const discount=(coupon?.discountPence||0)/100;
  const effectiveMinimum=giftOnly?0:Math.max(fallbackMinimum,fulfilment==="delivery"&&deliveryQuote?.allowed?deliveryQuote.minimumPence/100:0);

  const donation=useMemo(()=>{
    if(!roundup) return 0;
    const pennies=Math.max(0,Math.round((subtotal+shipping-discount)*100));
    const remainder=pennies%100;
    return (remainder===0?100:100-remainder)/100;
  },[roundup,subtotal,shipping,discount]);

  async function applyCoupon(){
    const code=couponCode.trim();
    if(!code){setCoupon(null);setCouponMessage("Enter a coupon or gift-card code.");return;}
    setCouponBusy(true);setCouponMessage("");
    try{
      const response=await fetch("/api/coupon/validate",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          code,
          email,
          items:items.map((item)=>({id:item.product.id,quantity:item.quantity}))
        })
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Coupon is not valid.");
      setCoupon(data);
      setCouponCode(data.code);
      setCouponMessage(data.source==="gift_card"?"Gift card applied.":"Coupon applied.");
    }catch(error){
      setCoupon(null);
      setCouponMessage(error instanceof Error?error.message:"Coupon is not valid.");
    }finally{
      setCouponBusy(false);
    }
  }

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setError("");

    if(!giftOnly&&fulfilment==="delivery"&&!deliveryQuote?.allowed){
      setError(deliveryQuote?.reason||"Enter an eligible delivery postcode.");
      return;
    }
    if(!giftOnly&&fulfilment==="collection"&&!collectionAllowed){
      setError("Collection is currently unavailable.");
      return;
    }

    setLoading(true);
    const form=new FormData(event.currentTarget);
    const customer=Object.fromEntries(["name","email","phone","address1","address2","city","postcode"].map((key)=>[key,String(form.get(key)||"")]));
    try{
      const response=await fetch("/api/checkout",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          items:items.map((item)=>({id:item.product.id,quantity:item.quantity})),
          fulfilment:giftOnly?undefined:fulfilment,
          roundup,
          couponCode:coupon?.code||couponCode.trim()||undefined,
          giftRecipientName:String(form.get("giftRecipientName")||""),
          giftRecipientEmail:String(form.get("giftRecipientEmail")||""),
          giftMessage:String(form.get("giftMessage")||""),
          customer
        })
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Checkout failed");
      window.location.href=data.url;
    }catch(err){
      setError(err instanceof Error?err.message:"Checkout failed");
      setLoading(false);
    }
  }

  if(!items.length) return <div className="empty-state"><h2>Your basket is empty</h2><p>Add meals or a gift card before checking out.</p></div>;

  const belowMinimum=!giftOnly&&physicalSubtotal<effectiveMinimum;
  const deliveryFull=!giftOnly&&Boolean(capacity&&capacity.deliveryRemaining<=0);
  const deliveryReady=giftOnly||fulfilment!=="delivery"||Boolean(deliveryQuote?.allowed);
  const finalTotal=Math.max(0,subtotal+shipping+donation-discount);

  return <form className="checkout-grid" onSubmit={submit}>
    <div className="checkout-form">
      <h2>Your details</h2>
      <div className="field-grid">
        <label>Full name<input name="name" required/></label>
        <label>Email<input name="email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required/></label>
        <label>Phone<input name="phone" type="tel" required={!giftOnly}/></label>
      </div>

      {hasGift&&<div className="giving-card" style={{display:"block"}}>
        <div><strong>E-gift card delivery</strong><small>Gift cards are delivered electronically after successful payment. No collection or delivery slot is used.</small></div>
        <div className="field-grid" style={{marginTop:12}}>
          <label>Recipient name<input name="giftRecipientName" placeholder="Who is it for?"/></label>
          <label>Recipient email<input name="giftRecipientEmail" type="email" placeholder={email||"recipient@example.com"} required/></label>
          <label style={{gridColumn:"1/-1"}}>Gift message<textarea name="giftMessage" rows={3} placeholder="Optional message for the recipient"/></label>
        </div>
      </div>}

      {!giftOnly&&<>
        <h2>Delivery or Collection Options</h2>
        <div className="choice-grid">
          <button type="button" disabled={!collectionAllowed} className={fulfilment==="collection"?"choice active":"choice"} onClick={()=>setFulfilment("collection")}>
            <strong>Collection</strong><span>{collectionAllowed?"Collect from Simple Kitchen":"Currently unavailable"}</span><b>Free</b>
          </button>
          <button type="button" disabled={deliveryFull} className={fulfilment==="delivery"?"choice active":"choice"} onClick={()=>setFulfilment("delivery")}>
            <strong>Delivery</strong>
            <span>{deliveryFull?"Delivery slots are full":capacity?capacity.deliveryRemaining+" slots remaining":"Only available in configured postcode zones"}</span>
            <b>{coupon?.freeShipping&&deliveryQuote?.allowed?"Free":deliveryQuote?.allowed?"£"+(deliveryQuote.feePence/100).toFixed(2):"Check postcode"}</b>
          </button>
        </div>

        {fulfilment==="delivery"&&<div className="field-grid address-fields">
          <label>Address<input name="address1" required/></label>
          <label>Address line 2<input name="address2"/></label>
          <label>Town / City<input name="city" required/></label>
          <label>Postcode<input name="postcode" value={postcode} onChange={(e)=>setPostcode(e.target.value)} autoComplete="postal-code" required/></label>
          <div className={deliveryQuote?.allowed?"capacity-pill":"error-box"}>
            {checkingPostcode?"Checking delivery area…":deliveryQuote?.allowed
              ? "Delivery available — "+deliveryQuote.zone?.name
              : deliveryQuote?.reason||"Enter your postcode to confirm delivery availability."}
          </div>
        </div>}
      </>}

      {giftOnly&&<div className="capacity-pill">Electronic delivery — no postcode or collection option required.</div>}

      <div className="coupon-card">
        <div><strong>Coupon or gift card</strong><small>Woo coupon codes and Simple Kitchen e-gift cards can be used here.</small></div>
        <div className="coupon-entry">
          <input value={couponCode} onChange={(e)=>{setCouponCode(e.target.value.toUpperCase());setCoupon(null);setCouponMessage("");}} placeholder="Enter code"/>
          <button type="button" className="btn btn-small" disabled={couponBusy} onClick={applyCoupon}>{couponBusy?"Checking…":"Apply"}</button>
        </div>
        {couponMessage&&<div className={coupon?"capacity-pill":"error-box"}>{couponMessage}{coupon&&coupon.discountPence>0?" — £"+(coupon.discountPence/100).toFixed(2)+" off":""}{coupon?.freeShipping?" + free delivery":""}</div>}
      </div>

      <label className="giving-card">
        <input type="checkbox" checked={roundup} onChange={(e)=>setRoundup(e.target.checked)}/>
        <span><strong>Christmas Giving</strong><small>Round your order up to the next whole pound. Simple Kitchen will match the final amount raised for local food banks and homeless charities.</small></span>
        {roundup&&<b>+£{donation.toFixed(2)}</b>}
      </label>

      {error&&<div className="error-box">{error}</div>}
    </div>

    <aside className="basket-summary sticky">
      <div className="eyebrow">Order total</div>
      <div className="summary-line"><span>{giftOnly?"Gift card":"Basket"}</span><strong>£{subtotal.toFixed(2)}</strong></div>
      <div className="summary-line"><span>{giftOnly?"E-delivery":fulfilment==="delivery"?"Delivery":"Collection"}</span><strong>{giftOnly?"Free":shipping?"£"+shipping.toFixed(2):fulfilment==="collection"?"Free":deliveryQuote?.allowed?"Free":"—"}</strong></div>
      {discount>0&&<div className="summary-line"><span>{coupon?.source==="gift_card"?"Gift card":"Coupon"} {coupon?.code}</span><strong>-£{discount.toFixed(2)}</strong></div>}
      {donation>0&&<div className="summary-line"><span>Christmas Giving</span><strong>£{donation.toFixed(2)}</strong></div>}
      <div className="summary-line total"><span>Total</span><strong>£{finalTotal.toFixed(2)}</strong></div>
      {!giftOnly&&capacity&&<div className="capacity-pill">{capacity.weeklyRemaining} weekly meal spaces remaining</div>}
      {belowMinimum&&<div className="error-box">Minimum meal order is £{effectiveMinimum.toFixed(2)}</div>}
      <button className="btn full" disabled={loading||belowMinimum||!deliveryReady||deliveryFull}>{loading?"Opening secure payment…":"Pay securely"}</button>
    </aside>
  </form>;
}
