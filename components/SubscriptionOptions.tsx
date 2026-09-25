"use client";
import { useEffect,useMemo,useState } from "react";
import type { SubscriptionCadence,SubscriptionPlan } from "@/lib/subscriptionPlans";

type DeliveryQuote={allowed:boolean;reason:string;zone:{id:string;name:string}|null;feePence:number;minimumPence:number};

export function SubscriptionOptions({plans}:{plans:SubscriptionPlan[]}){
  const [cadence,setCadence]=useState<SubscriptionCadence>((plans[0]?.id||"weekly") as SubscriptionCadence);
  const plan=plans.find((item)=>item.id===cadence)||plans[0];
  const [meals,setMeals]=useState(plan?.options[0]?.meals||4);
  const [fulfilment,setFulfilment]=useState<"collection"|"delivery">("collection");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [address1,setAddress1]=useState("");
  const [address2,setAddress2]=useState("");
  const [city,setCity]=useState("");
  const [postcode,setPostcode]=useState("");
  const [quote,setQuote]=useState<DeliveryQuote|null>(null);
  const [checking,setChecking]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const selected=useMemo(()=>plan?.options.find((item)=>item.meals===meals)||plan?.options[0],[plan,meals]);

  useEffect(()=>{
    if(fulfilment!=="delivery"||postcode.trim().length<5){setQuote(null);return;}
    setChecking(true);
    const timer=window.setTimeout(()=>{
      fetch("/api/fulfilment?postcode="+encodeURIComponent(postcode.trim()))
        .then((response)=>response.json())
        .then((data)=>setQuote(data.delivery||null))
        .catch(()=>setQuote({allowed:false,reason:"Unable to check this postcode right now.",zone:null,feePence:0,minimumPence:0}))
        .finally(()=>setChecking(false));
    },350);
    return()=>window.clearTimeout(timer);
  },[postcode,fulfilment]);

  if(!plan||!selected) return <div className="subscription-box"><div className="error-box">Subscriptions are temporarily unavailable.</div></div>;

  const deliveryPence=fulfilment==="delivery"&&quote?.allowed?quote.feePence*plan.fulfilmentsPerCycle:0;
  const total=(selected.pricePence+deliveryPence)/100;
  const cadenceLabel=plan.intervalWeeks===1?"week":"2 weeks";

  function changeCadence(value:SubscriptionCadence){
    setCadence(value);
    const next=plans.find((item)=>item.id===value);
    if(next&&!next.options.some((item)=>item.meals===meals)) setMeals(next.options[0].meals);
    setQuote(null);
  }

  async function start(){
    setError("");
    if(fulfilment==="delivery"&&!quote?.allowed){setError(quote?.reason||"Enter an eligible delivery postcode.");return;}
    if(fulfilment==="delivery"&&(!address1||!city||!postcode)){setError("Enter your delivery address and postcode.");return;}
    setLoading(true);
    try{
      const response=await fetch("/api/subscriptions",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({plan:cadence,meals,fulfilment,name,email,address1,address2,city,postcode})
      });
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
        <strong>{item.name}</strong><span>{item.description}</span><b>{item.intervalWeeks===1?(item.fulfilmentsPerCycle===2?"Two drops each week":"Every week"):"Every 2 weeks"}</b>
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
      <button type="button" className={fulfilment==="delivery"?"choice active":"choice"} onClick={()=>setFulfilment("delivery")}><strong>Delivery</strong><span>Checked against your postcode</span><b>{quote?.allowed?"+£"+((quote.feePence*plan.fulfilmentsPerCycle)/100).toFixed(2):"Check postcode"}</b></button>
    </div>

    {fulfilment==="delivery"&&<div className="field-grid address-fields">
      <label>Address<input value={address1} onChange={(e)=>setAddress1(e.target.value)} required/></label>
      <label>Address line 2<input value={address2} onChange={(e)=>setAddress2(e.target.value)}/></label>
      <label>Town / City<input value={city} onChange={(e)=>setCity(e.target.value)} required/></label>
      <label>Postcode<input value={postcode} onChange={(e)=>setPostcode(e.target.value)} required/></label>
      <div className={quote?.allowed?"capacity-pill":"error-box"}>{checking?"Checking delivery area…":quote?.allowed?"Delivery available — "+quote.zone?.name:quote?.reason||"Enter your postcode to confirm delivery availability."}</div>
    </div>}

    <div className="subscription-total"><span>Every {cadenceLabel}</span><strong>£{total.toFixed(2)}</strong></div>
    {error&&<div className="error-box">{error}</div>}
    <button className="btn full" disabled={loading||!name||!email||(fulfilment==="delivery"&&!quote?.allowed)} onClick={start}>{loading?"Opening secure payment…":"Subscribe "+cadence.replace("-"," ")}</button>
    <p className="fine-print">After subscribing, you’ll receive your personal meal-choice link for each subscription cycle.</p>
  </div>;
}
