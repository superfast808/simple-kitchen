"use client";
import { useState } from "react";

type Initial={
  cycleStartDate:string;menuForceState:"auto"|"open"|"closed";
  givingEnabled:boolean;givingStart:string;givingEnd:string;
  stripeConfigured:boolean;stripeWebhookConfigured:boolean;
};

export function AdminSettingsClient({initial}:{initial:Initial}){
  const [value,setValue]=useState(initial);
  const [stripeSecret,setStripeSecret]=useState("");
  const [stripeWebhookSecret,setStripeWebhookSecret]=useState("");
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  function patch(patch:Partial<Initial>){setValue((current)=>({...current,...patch}));}

  async function save(){
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/admin/settings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...value,stripeSecret,stripeWebhookSecret})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Save failed");
      setStripeSecret("");setStripeWebhookSecret("");
      setValue((current)=>({...current,stripeConfigured:data.stripeConfigured,stripeWebhookConfigured:data.stripeWebhookConfigured}));
      setMessage("Settings saved and applied.");
    }catch(error){setMessage(error instanceof Error?error.message:"Save failed");}
    finally{setSaving(false);}
  }

  return <div className="admin-section-grid">
    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Menu cycle</h2><p>Control the six-week cycle and emergency ordering state.</p></div></div>
      <div className="admin-form">
        <label>Cycle anchor date<input type="date" value={value.cycleStartDate} onChange={(e)=>patch({cycleStartDate:e.target.value})}/><span className="admin-help">Week 1 starts from this Saturday anchor. Change only when intentionally realigning the cycle.</span></label>
        <label>Ordering state<select value={value.menuForceState} onChange={(e)=>patch({menuForceState:e.target.value as Initial["menuForceState"]})}><option value="auto">Automatic — Saturday noon to Wednesday 23:59</option><option value="open">Force open</option><option value="closed">Force closed</option></select><span className="admin-help">Use force open/closed for exceptional situations; return to automatic afterwards.</span></label>
      </div>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Christmas Giving</h2><p>Round-up campaign and matching period.</p></div></div>
      <div className="admin-switch-row"><div><strong>Enable campaign</strong><small>Offer the round-up at checkout and record Simple Kitchen’s match.</small></div><button className={value.givingEnabled?"admin-switch on":"admin-switch"} onClick={()=>patch({givingEnabled:!value.givingEnabled})}></button></div>
      <div className="admin-form-grid" style={{marginTop:16}}><label>Starts<input type="date" value={value.givingStart} onChange={(e)=>patch({givingStart:e.target.value})}/></label><label>Ends<input type="date" value={value.givingEnd} onChange={(e)=>patch({givingEnd:e.target.value})}/></label></div>
    </section>

    <section className="admin-panel" style={{gridColumn:"1/-1"}}>
      <div className="admin-panel-head"><div><h2>Stripe</h2><p>Live checkout and subscription billing credentials.</p></div><div className="admin-toolbar"><span className={value.stripeConfigured?"admin-secret-state configured":"admin-secret-state"}>{value.stripeConfigured?"Secret key ready":"Secret key missing"}</span><span className={value.stripeWebhookConfigured?"admin-secret-state configured":"admin-secret-state"}>{value.stripeWebhookConfigured?"Webhook secret ready":"Webhook secret missing"}</span></div></div>
      <div className="admin-form-grid">
        <label>Stripe secret key<input type="password" placeholder={value.stripeConfigured?"Stored securely — enter only to replace":"sk_live_… or sk_test_…"} value={stripeSecret} onChange={(e)=>setStripeSecret(e.target.value)}/><span className="admin-help">Never displayed after saving.</span></label>
        <label>Stripe webhook signing secret<input type="password" placeholder={value.stripeWebhookConfigured?"Stored securely — enter only to replace":"whsec_…"} value={stripeWebhookSecret} onChange={(e)=>setStripeWebhookSecret(e.target.value)}/><span className="admin-help">Used to verify /api/stripe/webhook.</span></label>
      </div>
    </section>

    <section className="admin-panel" style={{gridColumn:"1/-1"}}>
      {message&&<div className={message.includes("saved")?"admin-alert success":"admin-alert danger"}>{message}</div>}
      <div className="admin-toolbar"><button className="admin-primary" disabled={saving} onClick={save}>{saving?"Saving…":"Save global settings"}</button><span className="admin-muted">Changes to cycle and Giving take effect immediately; Stripe credentials are hot-swapped on next request.</span></div>
    </section>
  </div>;
}
