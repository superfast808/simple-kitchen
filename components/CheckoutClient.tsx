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

export function CheckoutClient(){
  const {items,subtotal}=useCart();
  const [fulfilment,setFulfilment]=useState<"collection"|"delivery">("collection");
  const [roundup,setRoundup]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [postcode,setPostcode]=useState("");
  const [checkingPostcode,setCheckingPostcode]=useState(false);
  const [deliveryQuote,setDeliveryQuote]=useState<DeliveryQuote|null>(null);
  const [collectionAllowed,setCollectionAllowed]=useState(true);
  const [capacity,setCapacity]=useState<{deliveryRemaining:number;weeklyRemaining:number}|null>(null);

  useEffect(()=>{
    fetch("/api/capacity").then((r)=>r.json()).then(setCapacity).catch(()=>undefined);
    fetch("/api/fulfilment").then((r)=>r.json()).then((data)=>setCollectionAllowed(data.collection?.allowed!==false)).catch(()=>undefined);
  },[]);

  useEffect(()=>{
    if(fulfilment!=="delivery"){
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
      fetch("/api/fulfilment?postcode="+encodeURIComponent(trimmed))
        .then((r)=>r.json())
        .then((data)=>setDeliveryQuote(data.delivery||null))
        .catch(()=>setDeliveryQuote({allowed:false,reason:"Unable to check this postcode right now.",zone:null,feePence:0,minimumPence:0}))
        .finally(()=>setCheckingPostcode(false));
    },350);
    return()=>window.clearTimeout(timer);
  },[postcode,fulfilment]);

  const shipping=fulfilment==="delivery"&&deliveryQuote?.allowed?deliveryQuote.feePence/100:0;
  const effectiveMinimum=Math.max(fallbackMinimum,fulfilment==="delivery"&&deliveryQuote?.allowed?deliveryQuote.minimumPence/100:0);
  const donation=useMemo(()=>{
    if(!roundup) return 0;
    const pennies=Math.round((subtotal+shipping)*100);
    const remainder=pennies%100;
    return (remainder===0?100:100-remainder)/100;
  },[roundup,subtotal,shipping]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setError("");
    if(fulfilment==="delivery"&&!deliveryQuote?.allowed){
      setError(deliveryQuote?.reason||"Enter an eligible delivery postcode.");
      return;
    }
    if(fulfilment==="collection"&&!collectionAllowed){
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
        body:JSON.stringify({items:items.map((item)=>({id:item.product.id,quantity:item.quantity})),fulfilment,roundup,customer})
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Checkout failed");
      window.location.href=data.url;
    }catch(err){
      setError(err instanceof Error?err.message:"Checkout failed");
      setLoading(false);
    }
  }

  if(!items.length) return <div className="empty-state"><h2>Your basket is empty</h2><p>Add meals before checking out.</p></div>;

  const belowMinimum=subtotal<effectiveMinimum;
  const deliveryFull=Boolean(capacity&&capacity.deliveryRemaining<=0);
  const deliveryReady=fulfilment!=="delivery"||Boolean(deliveryQuote?.allowed);

  return <form className="checkout-grid" onSubmit={submit}>
    <div className="checkout-form">
      <h2>Your details</h2>
      <div className="field-grid">
        <label>Full name<input name="name" required/></label>
        <label>Email<input name="email" type="email" required/></label>
        <label>Phone<input name="phone" type="tel" required/></label>
      </div>

      <h2>Delivery or Collection Options</h2>
      <div className="choice-grid">
        <button type="button" disabled={!collectionAllowed} className={fulfilment==="collection"?"choice active":"choice"} onClick={()=>setFulfilment("collection")}>
          <strong>Collection</strong><span>{collectionAllowed?"Collect from Simple Kitchen":"Currently unavailable"}</span><b>Free</b>
        </button>
        <button type="button" disabled={deliveryFull} className={fulfilment==="delivery"?"choice active":"choice"} onClick={()=>setFulfilment("delivery")}>
          <strong>Delivery</strong>
          <span>{deliveryFull?"Delivery slots are full":capacity?capacity.deliveryRemaining+" slots remaining":"Subject to area and capacity"}</span>
          <b>{deliveryQuote?.allowed?"£"+(deliveryQuote.feePence/100).toFixed(2):"Check postcode"}</b>
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

      <label className="giving-card">
        <input type="checkbox" checked={roundup} onChange={(e)=>setRoundup(e.target.checked)}/>
        <span><strong>Christmas Giving</strong><small>Round your order up to the next whole pound. Simple Kitchen will match the final amount raised for local food banks and homeless charities.</small></span>
        {roundup&&<b>+£{donation.toFixed(2)}</b>}
      </label>

      {error&&<div className="error-box">{error}</div>}
    </div>

    <aside className="basket-summary sticky">
      <div className="eyebrow">Order total</div>
      <div className="summary-line"><span>Meals</span><strong>£{subtotal.toFixed(2)}</strong></div>
      <div className="summary-line"><span>{fulfilment==="delivery"?"Delivery":"Collection"}</span><strong>{shipping?"£"+shipping.toFixed(2):fulfilment==="collection"?"Free":"—"}</strong></div>
      {donation>0&&<div className="summary-line"><span>Christmas Giving</span><strong>£{donation.toFixed(2)}</strong></div>}
      <div className="summary-line total"><span>Total</span><strong>£{(subtotal+shipping+donation).toFixed(2)}</strong></div>
      {capacity&&<div className="capacity-pill">{capacity.weeklyRemaining} weekly meal spaces remaining</div>}
      {belowMinimum&&<div className="error-box">Minimum order is £{effectiveMinimum.toFixed(2)}</div>}
      <button className="btn full" disabled={loading||belowMinimum||!deliveryReady||deliveryFull}>{loading?"Opening secure payment…":"Pay securely"}</button>
    </aside>
  </form>;
}
