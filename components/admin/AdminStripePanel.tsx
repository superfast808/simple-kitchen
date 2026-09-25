"use client";
import { useState } from "react";

export function AdminStripePanel({configured,webhookConfigured,mode}:{configured:boolean;webhookConfigured:boolean;mode:string}){
  const [secret,setSecret]=useState("");
  const [webhook,setWebhook]=useState("");
  const [state,setState]=useState({configured,webhookConfigured,mode});
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  async function action(kind:"save"|"test"){
    setBusy(kind);setMessage("");
    try{
      const response=await fetch("/api/admin/stripe",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({action:kind,stripeSecret:secret,stripeWebhookSecret:webhook})
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Stripe action failed");
      if(kind==="save"){
        setSecret("");setWebhook("");
        setState({configured:data.configured,webhookConfigured:data.webhookConfigured,mode:data.mode});
        setMessage("Stripe credentials saved securely.");
      }else{
        setState((current)=>({...current,mode:data.livemode?"live":"test"}));
        setMessage("Stripe connection OK · "+(data.livemode?"LIVE":"TEST")+" mode"+(data.currencies?.length?" · "+data.currencies.join(", ").toUpperCase():""));
      }
    }catch(error){setMessage(error instanceof Error?error.message:"Stripe action failed");}
    finally{setBusy("");}
  }

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><h2>Payments & Stripe</h2><p>Checkout/subscription credentials and connection health.</p></div>
      <span className={state.configured?"admin-status live":"admin-status"}><span></span>{state.configured?(state.mode==="live"?"LIVE mode":state.mode==="test"?"TEST mode":"Configured"):"Not configured"}</span>
    </div>
    <div className="admin-form">
      <div className="admin-form-grid">
        <label>Stripe secret key<input type="password" value={secret} onChange={(e)=>setSecret(e.target.value)} placeholder={state.configured?"Stored securely — enter only to replace":"sk_live_… or sk_test_…"}/><span className="admin-help">The existing key is never sent back to the browser.</span></label>
        <label>Webhook signing secret<input type="password" value={webhook} onChange={(e)=>setWebhook(e.target.value)} placeholder={state.webhookConfigured?"Stored securely — enter only to replace":"whsec_…"}/><span className="admin-help">Verifies Stripe events at /api/stripe/webhook.</span></label>
      </div>
      <div className="admin-toolbar">
        <button className="admin-primary" disabled={busy==="save"||(!secret&&!webhook)} onClick={()=>action("save")}>{busy==="save"?"Saving…":"Save Stripe keys"}</button>
        <button className="admin-secondary" disabled={busy==="test"||!state.configured} onClick={()=>action("test")}>{busy==="test"?"Checking…":"Test Stripe connection"}</button>
        <span className={state.webhookConfigured?"admin-secret-state configured":"admin-secret-state"}>{state.webhookConfigured?"Webhook secret ready":"Webhook secret missing"}</span>
      </div>
      {message&&<div className={message.includes("failed")||message.includes("Unable")?"admin-alert danger":"admin-alert success"}>{message}</div>}
    </div>
  </section>;
}
