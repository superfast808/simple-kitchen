"use client";
import { useState } from "react";

type Initial={givingEnabled:boolean;givingStart:string;givingEnd:string};

export function AdminSettingsClient({initial}:{initial:Initial}){
  const [value,setValue]=useState(initial);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  function patch(patch:Partial<Initial>){setValue((current)=>({...current,...patch}));}

  async function save(){
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/admin/settings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(value)});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Save failed");
      setMessage("Business settings saved and applied.");
    }catch(error){setMessage(error instanceof Error?error.message:"Save failed");}
    finally{setSaving(false);}
  }

  return <div className="admin-section-grid">
    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Christmas Giving</h2><p>Round-up campaign and matching period.</p></div></div>
      <div className="admin-switch-row"><div><strong>Enable campaign</strong><small>Offer the round-up at checkout and record Simple Kitchen’s match.</small></div><button className={value.givingEnabled?"admin-switch on":"admin-switch"} onClick={()=>patch({givingEnabled:!value.givingEnabled})}></button></div>
      <div className="admin-form-grid" style={{marginTop:16}}><label>Starts<input type="date" value={value.givingStart} onChange={(e)=>patch({givingStart:e.target.value})}/></label><label>Ends<input type="date" value={value.givingEnd} onChange={(e)=>patch({givingEnd:e.target.value})}/></label></div>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Where controls live</h2><p>Operational settings are separated by function.</p></div></div>
      <div className="admin-action-list">
        <a href="/admin/weeks"><span>◷</span><div><strong>Weeks & schedule</strong><small>Six-week rotation, opening/closing times and fulfilment offset</small></div><b>›</b></a>
        <a href="/admin"><span>£</span><div><strong>Stripe</strong><small>Keys, webhook secret and connection test on the main dashboard</small></div><b>›</b></a>
        <a href="/admin/fulfilment"><span>⌖</span><div><strong>Delivery & collection</strong><small>Shipping zones, postcode rules, fees and capacity</small></div><b>›</b></a>
      </div>
    </section>

    <section className="admin-panel" style={{gridColumn:"1/-1"}}>
      {message&&<div className={message.includes("saved")?"admin-alert success":"admin-alert danger"}>{message}</div>}
      <button className="admin-primary" disabled={saving} onClick={save}>{saving?"Saving…":"Save business settings"}</button>
    </section>
  </div>;
}
