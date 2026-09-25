"use client";
import { useMemo,useState } from "react";

type Plan={
  id:"weekly"|"fortnightly"|"twice-weekly";
  name:string;description:string;enabled:boolean;public:boolean;intervalWeeks:number;fulfilmentsPerCycle:number;
  options:{meals:number;pricePence:number;wooVariationId:number}[];
};

export function AdminSubscriptionPlans({initial}:{initial:Plan[]}){
  const [plans,setPlans]=useState(initial);
  const [selectedId,setSelectedId]=useState<Plan["id"]>(initial[0]?.id||"weekly");
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const selected=useMemo(()=>plans.find((plan)=>plan.id===selectedId)||plans[0],[plans,selectedId]);

  function patchPlan(patch:Partial<Plan>){
    setPlans((current)=>current.map((plan)=>plan.id===selectedId?{...plan,...patch}:plan));
  }
  function patchPrice(meals:number,pricePence:number){
    setPlans((current)=>current.map((plan)=>plan.id===selectedId?{
      ...plan,options:plan.options.map((option)=>option.meals===meals?{...option,pricePence}:option)
    }:plan));
  }

  async function save(){
    if(!selected) return;
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/admin/subscription-plans",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
        id:selected.id,name:selected.name,description:selected.description,enabled:selected.enabled,public:selected.public,
        prices:Object.fromEntries(selected.options.map((option)=>[String(option.meals),option.pricePence]))
      })});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Save failed");
      setMessage(selected.name+" saved.");
    }catch(error){setMessage(error instanceof Error?error.message:"Save failed");}
    finally{setSaving(false);}
  }

  if(!selected) return null;

  return <section className="admin-panel" style={{marginBottom:18}}>
    <div className="admin-panel-head"><div><h2>Subscription plans</h2><p>Pricing, copy, availability and public visibility.</p></div></div>
    <div className="admin-tabs" style={{marginBottom:16}}>
      {plans.map((plan)=><button key={plan.id} className={selectedId===plan.id?"admin-secondary active":"admin-secondary"} onClick={()=>setSelectedId(plan.id)}>{plan.name}</button>)}
    </div>
    <div className="admin-section-grid">
      <div className="admin-form">
        <label>Plan name<input value={selected.name} onChange={(e)=>patchPlan({name:e.target.value})}/></label>
        <label>Description<textarea rows={3} value={selected.description} onChange={(e)=>patchPlan({description:e.target.value})}/></label>
        <div className="admin-switch-row"><div><strong>Plan enabled</strong><small>Allow new checkouts for this plan.</small></div><button className={selected.enabled?"admin-switch on":"admin-switch"} onClick={()=>patchPlan({enabled:!selected.enabled})}></button></div>
        <div className="admin-switch-row"><div><strong>Show publicly</strong><small>Display on the public subscriptions page.</small></div><button className={selected.public?"admin-switch on":"admin-switch"} disabled={!selected.enabled} onClick={()=>patchPlan({public:!selected.public})}></button></div>
        <div className="admin-card-row"><div><strong>Billing / fulfilment</strong><small>{selected.intervalWeeks===2?"Every 2 weeks":"Weekly billing"} · {selected.fulfilmentsPerCycle} fulfilment{selected.fulfilmentsPerCycle===1?"":"s"} per cycle</small></div></div>
      </div>
      <div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Meals</th><th>Price per billing cycle</th><th>Woo variation</th></tr></thead><tbody>
          {selected.options.map((option)=><tr key={option.meals}><td><strong>{option.meals}</strong></td><td><input className="admin-input" type="number" min="0" step=".01" value={(option.pricePence/100).toFixed(2)} onChange={(e)=>patchPrice(option.meals,Math.max(0,Math.round(Number(e.target.value)*100)))}/></td><td><small>{option.wooVariationId}</small></td></tr>)}
        </tbody></table></div>
      </div>
    </div>
    {message&&<div className={message.includes("saved")?"admin-alert success":"admin-alert danger"} style={{marginTop:14}}>{message}</div>}
    <div className="admin-toolbar" style={{marginTop:14}}><button className="admin-primary" disabled={saving} onClick={save}>{saving?"Saving…":"Save plan"}</button><span className="admin-muted">Changes affect new subscriptions only; existing Stripe subscriptions are not repriced.</span></div>
  </section>;
}
