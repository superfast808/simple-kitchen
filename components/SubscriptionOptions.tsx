"use client";
import { useState } from "react";

export function SubscriptionOptions({ options, deliveryFee }: { options:{meals:number;weeklyPence:number}[]; deliveryFee:number }) {
  const [meals,setMeals] = useState(options[0]?.meals || 5);
  const [fulfilment,setFulfilment] = useState<"collection"|"delivery">("collection");
  const [name,setName] = useState(""); const [email,setEmail] = useState("");
  const [loading,setLoading] = useState(false); const [error,setError] = useState("");
  const selected = options.find(o=>o.meals===meals)!;
  const total = (selected.weeklyPence + (fulfilment==="delivery"?deliveryFee:0))/100;

  async function start() {
    setLoading(true);setError("");
    try {
      const response=await fetch("/api/subscriptions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({meals,fulfilment,name,email})});
      const data=await response.json(); if(!response.ok) throw new Error(data.error||"Unable to continue");
      window.location.href=data.url;
    } catch(e){setError(e instanceof Error?e.message:"Unable to continue");setLoading(false);}
  }

  return <div className="subscription-box">
    <div className="subscription-options">{options.map(option=><button key={option.meals} className={meals===option.meals?"sub-option active":"sub-option"} onClick={()=>setMeals(option.meals)}><strong>{option.meals} meals</strong><span>£{(option.weeklyPence/100).toFixed(2)} / week</span></button>)}</div>
    <div className="field-grid"><label>Name<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label></div>
    <div className="choice-grid"><button type="button" className={fulfilment==="collection"?"choice active":"choice"} onClick={()=>setFulfilment("collection")}><strong>Collection</strong><b>Free</b></button><button type="button" className={fulfilment==="delivery"?"choice active":"choice"} onClick={()=>setFulfilment("delivery")}><strong>Weekly delivery</strong><b>+£{(deliveryFee/100).toFixed(2)}</b></button></div>
    <div className="subscription-total"><span>Weekly total</span><strong>£{total.toFixed(2)}</strong></div>
    {error && <div className="error-box">{error}</div>}
    <button className="btn full" disabled={loading||!name||!email} onClick={start}>{loading?"Opening secure payment…":"Subscribe weekly"}</button>
    <p className="fine-print">After subscribing, you’ll receive your personal weekly link to choose the meals from each live menu.</p>
  </div>;
}
