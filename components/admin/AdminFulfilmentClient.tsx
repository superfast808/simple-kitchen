"use client";
import { useState } from "react";

type Zone={id:string;name:string;prefixes:string[];feePence:number;minimumPence:number;enabled:boolean};
type Settings={
  weeklyItemCap:number;deliverySlotCap:number;deliveryFeePence:number;minimumOrderPence:number;
  deliveryEnabled:boolean;collectionEnabled:boolean;deliveryRequireZoneMatch:boolean;deliveryZones:Zone[];
};

export function AdminFulfilmentClient({initial}:{initial:Settings}){
  const [value,setValue]=useState(initial);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  function patch(patch:Partial<Settings>){setValue((current)=>({...current,...patch}));}
  function patchZone(index:number,patch:Partial<Zone>){
    setValue((current)=>({...current,deliveryZones:current.deliveryZones.map((zone,i)=>i===index?{...zone,...patch}:zone)}));
  }
  function addZone(){
    setValue((current)=>({...current,deliveryZones:[...current.deliveryZones,{id:"zone-"+Date.now(),name:"New delivery area",prefixes:[],feePence:current.deliveryFeePence,minimumPence:current.minimumOrderPence,enabled:true}]}));
  }
  function removeZone(index:number){setValue((current)=>({...current,deliveryZones:current.deliveryZones.filter((_,i)=>i!==index)}));}

  async function save(){
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/admin/fulfilment",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(value)});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Save failed");
      setMessage("Fulfilment settings saved and live.");
    }catch(error){setMessage(error instanceof Error?error.message:"Save failed");}
    finally{setSaving(false);}
  }

  return <div className="admin-section-grid">
    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Availability & capacity</h2><p>These controls affect checkout immediately.</p></div></div>
      <div className="admin-switch-row"><div><strong>Delivery</strong><small>Allow customers to choose delivery</small></div><button className={value.deliveryEnabled?"admin-switch on":"admin-switch"} onClick={()=>patch({deliveryEnabled:!value.deliveryEnabled})}></button></div>
      <div className="admin-switch-row"><div><strong>Collection</strong><small>Allow collection from Simple Kitchen</small></div><button className={value.collectionEnabled?"admin-switch on":"admin-switch"} onClick={()=>patch({collectionEnabled:!value.collectionEnabled})}></button></div>
      <div className="admin-switch-row"><div><strong>Strict delivery areas</strong><small>Reject postcodes that do not match a configured zone</small></div><button className={value.deliveryRequireZoneMatch?"admin-switch on":"admin-switch"} onClick={()=>patch({deliveryRequireZoneMatch:!value.deliveryRequireZoneMatch})}></button></div>
      <div className="admin-form-grid" style={{marginTop:17}}>
        <label>Weekly meal capacity<input className="admin-input" type="number" min="1" value={value.weeklyItemCap} onChange={(e)=>patch({weeklyItemCap:Number(e.target.value)})}/></label>
        <label>Delivery slot capacity<input className="admin-input" type="number" min="0" value={value.deliverySlotCap} onChange={(e)=>patch({deliverySlotCap:Number(e.target.value)})}/></label>
        <label>Default delivery fee (£)<input className="admin-input" type="number" min="0" step=".01" value={(value.deliveryFeePence/100).toFixed(2)} onChange={(e)=>patch({deliveryFeePence:Math.round(Number(e.target.value)*100)})}/></label>
        <label>Default minimum order (£)<input className="admin-input" type="number" min="0" step=".01" value={(value.minimumOrderPence/100).toFixed(2)} onChange={(e)=>patch({minimumOrderPence:Math.round(Number(e.target.value)*100)})}/></label>
      </div>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Delivery areas</h2><p>Postcode prefixes, fee and minimum per area.</p></div><button className="admin-secondary" onClick={addZone}>+ Add area</button></div>
      <div className="admin-card-list">
        {value.deliveryZones.map((zone,index)=><div className="admin-zone-editor" key={zone.id}>
          <div className="admin-zone-head"><input className="admin-input" value={zone.name} onChange={(e)=>patchZone(index,{name:e.target.value})}/><button className={zone.enabled?"admin-switch on":"admin-switch"} onClick={()=>patchZone(index,{enabled:!zone.enabled})}></button></div>
          <label>Postcode prefixes<input className="admin-input" placeholder="G44, G45, G46" value={zone.prefixes.join(", ")} onChange={(e)=>patchZone(index,{prefixes:e.target.value.split(",").map((p)=>p.trim().toUpperCase()).filter(Boolean)})}/><span className="admin-help">Comma-separated. Prefix matching is case/space insensitive.</span></label>
          <div className="admin-form-grid"><label>Fee (£)<input className="admin-input" type="number" step=".01" min="0" value={(zone.feePence/100).toFixed(2)} onChange={(e)=>patchZone(index,{feePence:Math.round(Number(e.target.value)*100)})}/></label><label>Minimum (£)<input className="admin-input" type="number" step=".01" min="0" value={(zone.minimumPence/100).toFixed(2)} onChange={(e)=>patchZone(index,{minimumPence:Math.round(Number(e.target.value)*100)})}/></label></div>
          <button className="admin-danger" onClick={()=>removeZone(index)}>Remove area</button>
        </div>)}
        {!value.deliveryZones.length&&<div className="admin-empty">No explicit zones yet. Add the live Woo delivery areas before enabling strict matching.</div>}
      </div>
    </section>

    <div className="admin-panel wide" style={{gridColumn:"1/-1"}}>
      {message&&<div className={message.includes("saved")?"admin-alert success":"admin-alert danger"}>{message}</div>}
      <div className="admin-toolbar"><button className="admin-primary" disabled={saving} onClick={save}>{saving?"Saving…":"Save fulfilment settings"}</button><span className="admin-muted">Changes are picked up by postcode checks and checkout immediately.</span></div>
    </div>
  </div>;
}
