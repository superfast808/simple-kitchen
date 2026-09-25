"use client";
import { useMemo,useState } from "react";

type Option={meals:number;pricePence:number;wooVariationId:number;enabled?:boolean};
type Plan={
  id:"weekly"|"fortnightly"|"twice-weekly";
  name:string;description:string;enabled:boolean;public:boolean;intervalWeeks:number;fulfilmentsPerCycle:number;wooProductId:number;
  options:Option[];
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
  function patchOption(index:number,patch:Partial<Option>){
    setPlans((current)=>current.map((plan)=>plan.id===selectedId?{
      ...plan,options:plan.options.map((option,i)=>i===index?{...option,...patch}:option)
    }:plan));
  }
  function addOption(){
    if(!selected) return;
    const max=Math.max(0,...selected.options.map((option)=>option.meals));
    patchPlan({options:[...selected.options,{meals:max+1,pricePence:0,wooVariationId:0,enabled:true}]});
  }
  function removeOption(index:number){
    if(!selected) return;
    patchPlan({options:selected.options.filter((_,i)=>i!==index)});
  }

  async function save(){
    if(!selected) return;
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/admin/subscription-plans",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
        id:selected.id,name:selected.name,description:selected.description,enabled:selected.enabled,public:selected.public,
        intervalWeeks:selected.intervalWeeks,fulfilmentsPerCycle:selected.fulfilmentsPerCycle,wooProductId:selected.wooProductId,
        options:selected.options
      })});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Save failed");
      setMessage(selected.name+" saved.");
    }catch(error){setMessage(error instanceof Error?error.message:"Save failed");}
    finally{setSaving(false);}
  }

  async function syncWoo(){
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/admin/subscription-plans/import-woo",{method:"POST"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Woo sync failed");
      setPlans(data.plans);
      setMessage("Woo subscription variations synced.");
    }catch(error){setMessage(error instanceof Error?error.message:"Woo sync failed");}
    finally{setSaving(false);}
  }

  if(!selected) return null;

  return <section className="admin-panel" style={{marginBottom:18}}>
    <div className="admin-panel-head"><div><h2>Subscription plans</h2><p>Plan identity, billing rhythm, availability and editable variations.</p></div><button className="admin-secondary" disabled={saving} onClick={syncWoo}>↻ Sync Woo variations</button></div>
    <div className="admin-tabs" style={{marginBottom:16}}>
      {plans.map((plan)=><button key={plan.id} className={selectedId===plan.id?"admin-secondary active":"admin-secondary"} onClick={()=>setSelectedId(plan.id)}>{plan.name||plan.id}</button>)}
    </div>

    <div className="admin-section-grid">
      <div className="admin-form">
        <label>Plan name<input value={selected.name} onChange={(e)=>patchPlan({name:e.target.value})}/></label>
        <label>Description<textarea rows={3} value={selected.description} onChange={(e)=>patchPlan({description:e.target.value})}/></label>
        <div className="admin-form-grid">
          <label>Woo parent product ID<input type="number" min="0" value={selected.wooProductId} onChange={(e)=>patchPlan({wooProductId:Number(e.target.value)||0})}/></label>
          <label>Billing interval<select value={selected.intervalWeeks} onChange={(e)=>patchPlan({intervalWeeks:Number(e.target.value)})}><option value={1}>Every week</option><option value={2}>Every 2 weeks</option></select></label>
          <label>Fulfilments per cycle<select value={selected.fulfilmentsPerCycle} onChange={(e)=>patchPlan({fulfilmentsPerCycle:Number(e.target.value)})}><option value={1}>1 fulfilment</option><option value={2}>2 fulfilments</option></select></label>
        </div>
        <div className="admin-switch-row"><div><strong>Plan enabled</strong><small>Allow new checkouts for this plan.</small></div><button className={selected.enabled?"admin-switch on":"admin-switch"} onClick={()=>patchPlan({enabled:!selected.enabled})}></button></div>
        <div className="admin-switch-row"><div><strong>Show publicly</strong><small>Display on the customer subscriptions page.</small></div><button className={selected.public?"admin-switch on":"admin-switch"} disabled={!selected.enabled} onClick={()=>patchPlan({public:!selected.public})}></button></div>
      </div>

      <div>
        <div className="admin-panel-head"><div><h2>Variations</h2><p>Meal quantity, billing price and Woo variation mapping.</p></div><button className="admin-secondary" onClick={addOption}>+ Add variation</button></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Active</th><th>Meals</th><th>Price</th><th>Woo variation</th><th></th></tr></thead><tbody>
          {selected.options.map((option,index)=><tr key={index}>
            <td><button className={option.enabled!==false?"admin-switch on":"admin-switch"} onClick={()=>patchOption(index,{enabled:option.enabled===false})}></button></td>
            <td><input className="admin-input" type="number" min="1" max="60" value={option.meals} onChange={(e)=>patchOption(index,{meals:Math.max(1,Number(e.target.value)||1)})}/></td>
            <td><input className="admin-input" type="number" min="0" step=".01" value={(option.pricePence/100).toFixed(2)} onChange={(e)=>patchOption(index,{pricePence:Math.max(0,Math.round(Number(e.target.value)*100))})}/></td>
            <td><input className="admin-input" type="number" min="0" value={option.wooVariationId||""} onChange={(e)=>patchOption(index,{wooVariationId:Math.max(0,Number(e.target.value)||0)})}/></td>
            <td><button className="admin-danger" onClick={()=>removeOption(index)}>Remove</button></td>
          </tr>)}
          {!selected.options.length&&<tr><td colSpan={5}><div className="admin-empty">No variations. Add one before enabling this plan.</div></td></tr>}
        </tbody></table></div>
      </div>
    </div>

    {message&&<div className={message.includes("saved")||message.includes("synced")?"admin-alert success":"admin-alert danger"} style={{marginTop:14}}>{message}</div>}
    <div className="admin-toolbar" style={{marginTop:14}}><button className="admin-primary" disabled={saving||!selected.options.length} onClick={save}>{saving?"Saving…":"Save plan"}</button><span className="admin-muted">Changes affect new subscriptions only; existing Stripe subscriptions are not repriced.</span></div>
  </section>;
}
