"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useCart } from "./CartProvider";

const deliveryFee = Number(process.env.NEXT_PUBLIC_DELIVERY_FEE || 3);
const minimum = Number(process.env.NEXT_PUBLIC_MINIMUM_ORDER_AMOUNT || 0);

export function CheckoutClient() {
  const { items, subtotal } = useCart();
  const [fulfilment,setFulfilment] = useState<"collection"|"delivery">("collection");
  const [roundup,setRoundup] = useState(false);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [capacity,setCapacity] = useState<{deliveryRemaining:number;weeklyRemaining:number}|null>(null);

  useEffect(() => { fetch("/api/capacity").then(r => r.json()).then(setCapacity).catch(() => undefined); }, []);
  const shipping = fulfilment === "delivery" ? deliveryFee : 0;
  const donation = useMemo(() => {
    if (!roundup) return 0;
    const pennies = Math.round((subtotal + shipping) * 100);
    const remainder = pennies % 100;
    return (remainder === 0 ? 100 : 100-remainder) / 100;
  },[roundup,subtotal,shipping]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const customer = Object.fromEntries(["name","email","phone","address1","address2","city","postcode"].map(k => [k,String(form.get(k)||"")]));
    try {
      const response = await fetch("/api/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({items:items.map(i=>({id:i.product.id,quantity:i.quantity})),fulfilment,roundup,customer})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Checkout failed");
      window.location.href = data.url;
    } catch (e) { setError(e instanceof Error ? e.message : "Checkout failed"); setLoading(false); }
  }

  if (!items.length) return <div className="empty-state"><h2>Your basket is empty</h2><p>Add meals before checking out.</p></div>;
  const belowMinimum = subtotal < minimum;

  return <form className="checkout-grid" onSubmit={submit}>
    <div className="checkout-form">
      <h2>Your details</h2>
      <div className="field-grid"><label>Full name<input name="name" required/></label><label>Email<input name="email" type="email" required/></label><label>Phone<input name="phone" type="tel" required/></label></div>
      <h2>Delivery or Collection Options</h2>
      <div className="choice-grid">
        <button type="button" className={fulfilment==="collection"?"choice active":"choice"} onClick={()=>setFulfilment("collection")}><strong>Collection</strong><span>Collect from Simple Kitchen</span><b>Free</b></button>
        <button type="button" className={fulfilment==="delivery"?"choice active":"choice"} onClick={()=>setFulfilment("delivery")}><strong>Delivery</strong><span>{capacity ? `${capacity.deliveryRemaining} slots remaining` : "Subject to coverage and capacity"}</span><b>£{deliveryFee.toFixed(2)}</b></button>
      </div>
      {fulfilment === "delivery" && <div className="field-grid address-fields"><label>Address<input name="address1" required/></label><label>Address line 2<input name="address2"/></label><label>Town / City<input name="city" required/></label><label>Postcode<input name="postcode" required/></label></div>}
      <label className="giving-card"><input type="checkbox" checked={roundup} onChange={(e)=>setRoundup(e.target.checked)}/><span><strong>Christmas Giving</strong><small>Round your order up to the next whole pound. Simple Kitchen will match the final amount raised for local food banks and homeless charities.</small></span>{roundup && <b>+£{donation.toFixed(2)}</b>}</label>
      {error && <div className="error-box">{error}</div>}
    </div>
    <aside className="basket-summary sticky"><div className="eyebrow">Order total</div><div className="summary-line"><span>Meals</span><strong>£{subtotal.toFixed(2)}</strong></div><div className="summary-line"><span>{fulfilment==="delivery"?"Delivery":"Collection"}</span><strong>{shipping ? `£${shipping.toFixed(2)}` : "Free"}</strong></div>{donation>0 && <div className="summary-line"><span>Christmas Giving</span><strong>£{donation.toFixed(2)}</strong></div>}<div className="summary-line total"><span>Total</span><strong>£{(subtotal+shipping+donation).toFixed(2)}</strong></div>{capacity && <div className="capacity-pill">{capacity.weeklyRemaining} weekly meal spaces remaining</div>}{belowMinimum && <div className="error-box">Minimum order is £{minimum.toFixed(2)}</div>}<button className="btn full" disabled={loading||belowMinimum}>{loading?"Opening secure payment…":"Pay securely"}</button></aside>
  </form>;
}
