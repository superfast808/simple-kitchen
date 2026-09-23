"use client";
import { useMemo, useState } from "react";
import type { SubscriptionCadence, SubscriptionPlan } from "@/lib/subscriptionPlans";

export function SubscriptionOptions({ plans,deliveryFee }:{ plans:SubscriptionPlan[]; deliveryFee:number }) {
  const [cadence,setCadence]=useState<SubscriptionCadence>("weekly");
  const plan=plans.find((item)=>item.id===cadence)||plans[0];
  const [meals,setMeals]=useState(4);
  const [fulfilment,setFulfilment]=useState<"collection"|"delivery">("collection");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const selected=useMemo(()=>plan.options.find((item)=>item.meals===meals)||plan.options[0],[plan,meals]);
  const deliveryPence=fulfilment==="delivery"?deliveryFee:0;
  const total=(selected.pricePence+deliveryPence)/100;
  const cadenceLabel=plan.intervalWeeks===1?"week":"2 weeks";

  function changeCadence(value:SubscriptionCadence){
    setCadence(value);
    const next=plans.find((item)=>item.id===value);
    if(next&&!next.options.some((item)=>item.meals===meals)) setMeals(next.options[0].meals);
  }

  async function start(){
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/subscriptions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({plan:cadence,meals,fulfilment,name,email})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to continue");
      window.location.href=data.url;
    }catch(error){
      setError(error instanceof Error?error.message:"Unable to continue");
      setLoading(false);
    }
  }

  return <div className="subscription-box">
    <div className="choice-grid">
      {plans.map((item)=><button type="button" key={item.id} className={cadence===item.id?"choice active":"choice"} onClick={()=>changeCadence(item.id)}>
        <strong>{item.name}</strong><span>{item.description}</span><b>{item.intervalWeeks===1?"Every week":"Every 2 weeks"}</b>
      </button>)}
    </div>

    <label className="subscription-meal-select">Meal Quantity
      <select value={meals} onChange={(e)=>setMeals(Number(e.target.value))}>
        {plan.options.map((option)=><option value={option.meals} key={option.meals}>{option.meals} meals — £{(option.pricePence/100).toFixed(2)}</option>)}
      </select>
    </label>

    <div className="field-grid">
      <label>Name<input value={name} onChange={(e)=>setName(e.target.value)} required/></label>
      <label>Email<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required/></label>
    </div>

    <div className="choice-grid">
      <button type="button" className={fulfilment==="collection"?"choice active":"choice"} onClick={()=>setFulfilment("collection")}><strong>Collection</strong><b>Free</b></button>
      <button type="button" className={fulfilment==="delivery"?"choice active":"choice"} onClick={()=>setFulfilment("delivery")}><strong>Delivery</strong><b>+£{(deliveryFee/100).toFixed(2)}</b></button>
    </div>

    <div className="subscription-total"><span>Every {cadenceLabel}</span><strong>£{total.toFixed(2)}</strong></div>
    {error&&<div className="error-box">{error}</div>}
    <button className="btn full" disabled={loading||!name||!email} onClick={start}>{loading?"Opening secure payment…":"Subscribe "+cadence}</button>
    <p className="fine-print">After subscribing, you’ll receive your personal meal-choice link for each subscription cycle.</p>
  </div>;
}
