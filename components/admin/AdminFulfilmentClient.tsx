"use client";
import { useState } from "react";

type Zone={
  id:string;name:string;patterns:string[];deliveryEnabled:boolean;collectionEnabled:boolean;
  feePence:number;minimumPence:number;freeDeliveryMinimumPence:number|null;
};
type Settings={
  weeklyItemCap:number;deliverySlotCap:number;deliveryFeePence:number;minimumOrderPence:number;
  deliveryEnabled:boolean;collectionEnabled:boolean;deliveryZones:Zone[];
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
    setValue((current)=>({...current,deliveryZones:[
      ...current.deliveryZones.slice(0,-1),
      {id:"zone-"+Date.now(),name:"New shipping zone",patterns:[],deliveryEnabled:true,collectionEnabled:true,feePence:current.deliveryFeePence,minimumPence:current.minimumOrderPence,freeDeliveryMinimumPence:null},
      ...current.deliveryZones.slice(-1)
    ]}));
  }
  function removeZone(index:number){setValue((current)=>({...current,deliveryZones:current.deliveryZones.filter((_,i)=>i!==index)}));}
  function moveZone(index:number,direction:-1|1){
    setValue((current)=>{
      const next=[...current.deliveryZones];
      const target=index+direction;
      if(target<0||target>=next.length) return current;
      [next[index],next[target]]=[next[target],next[index]];
      return {...current,deliveryZones:next};
    });
  }

  async function syncWoo(){
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/admin/fulfilment/import-woo",{method:"POST"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Woo shipping sync failed");
      setValue((current)=>({...current,deliveryZones:data.zones}));
      setMessage("Woo shipping zones synced and saved.");
    }catch(error){setMessage(error instanceof Error?error.message:"Woo shipping sync failed");}
    finally{setSaving(false);}
  }

  async function save(){
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/admin/fulfilment",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(value)});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Save failed");
      setMessage("Shipping zones saved and live.");
    }catch(error){setMessage(error instanceof Error?error.message:"Save failed");}
    finally{setSaving(false);}
  }

  return <div className="admin-section-grid">
    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Availability & capacity</h2><p>Global fulfilment switches and weekly limits.</p></div></div>
      <div className="admin-switch-row"><div><strong>Delivery</strong><small>Delivery is only offered when a postcode matches an enabled delivery zone below.</small></div><button className={value.deliveryEnabled?"admin-switch on":"admin-switch"} onClick={()=>patch({deliveryEnabled:!value.deliveryEnabled})}></button></div>
      <div className="admin-switch-row"><div><strong>Collection</strong><small>Collection remains independent of the customer postcode.</small></div><button className={value.collectionEnabled?"admin-switch on":"admin-switch"} onClick={()=>patch({collectionEnabled:!value.collectionEnabled})}></button></div>
      <div className="admin-alert success" style={{marginTop:14}}>Strict postcode matching is enforced. An unmatched postcode never receives a delivery option.</div>
      <div className="admin-form-grid" style={{marginTop:17}}>
        <label>Weekly meal capacity<input className="admin-input" type="number" min="1" value={value.weeklyItemCap} onChange={(e)=>patch({weeklyItemCap:Number(e.target.value)})}/></label>
        <label>Delivery slot capacity<input className="admin-input" type="number" min="0" value={value.deliverySlotCap} onChange={(e)=>patch({deliverySlotCap:Number(e.target.value)})}/></label>
        <label>Default delivery fee (£)<input className="admin-input" type="number" min="0" step=".01" value={(value.deliveryFeePence/100).toFixed(2)} onChange={(e)=>patch({deliveryFeePence:Math.round(Number(e.target.value)*100)})}/></label>
        <label>Default minimum order (£)<input className="admin-input" type="number" min="0" step=".01" value={(value.minimumOrderPence/100).toFixed(2)} onChange={(e)=>patch({minimumOrderPence:Math.round(Number(e.target.value)*100)})}/></label>
      </div>
    </section>

    <section className="admin-panel" style={{gridColumn:"1/-1"}}>
      <div className="admin-panel-head"><div><h2>Shipping zones</h2><p>Woo-style first-match priority. Higher zones win over broader zones beneath them.</p></div><div className="admin-toolbar"><button className="admin-secondary" disabled={saving} onClick={syncWoo}>↻ Sync Woo</button><button className="admin-secondary" onClick={addZone}>+ Add zone</button></div></div>
      <div className="admin-card-list">
        {value.deliveryZones.map((zone,index)=><div className="admin-zone-editor" key={zone.id}>
          <div className="admin-zone-head">
            <div style={{display:"flex",gap:7}}>
              <button className="admin-secondary" disabled={index===0} onClick={()=>moveZone(index,-1)}>↑</button>
              <button className="admin-secondary" disabled={index===value.deliveryZones.length-1} onClick={()=>moveZone(index,1)}>↓</button>
            </div>
            <input className="admin-input" value={zone.name} onChange={(e)=>patchZone(index,{name:e.target.value})}/>
            <span className="admin-muted">Priority {index+1}</span>
          </div>

          <label>Postcodes / wildcard patterns
            <textarea className="admin-input" rows={3} placeholder="G44*, G45*, PA1*" value={zone.patterns.join(", ")} onChange={(e)=>patchZone(index,{patterns:e.target.value.split(",").map((p)=>p.trim().toUpperCase()).filter(Boolean)})}/>
            <span className="admin-help">{zone.patterns.length?"First matching zone wins. Use Woo-style * wildcard patterns.":"No postcode patterns = fallback zone."}</span>
          </label>

          <div className="admin-method-grid">
            <div className="admin-method-card">
              <div className="admin-switch-row"><div><strong>Delivery method</strong><small>{zone.deliveryEnabled?"Offered for matching postcodes":"Not offered in this zone"}</small></div><button className={zone.deliveryEnabled?"admin-switch on":"admin-switch"} onClick={()=>patchZone(index,{deliveryEnabled:!zone.deliveryEnabled})}></button></div>
              <div className="admin-form-grid">
                <label>Flat rate (£)<input className="admin-input" type="number" step=".01" min="0" value={(zone.feePence/100).toFixed(2)} onChange={(e)=>patchZone(index,{feePence:Math.round(Number(e.target.value)*100)})}/></label>
                <label>Minimum order (£)<input className="admin-input" type="number" step=".01" min="0" value={(zone.minimumPence/100).toFixed(2)} onChange={(e)=>patchZone(index,{minimumPence:Math.round(Number(e.target.value)*100)})}/></label>
                <label className="wide">Free delivery from (£)<input className="admin-input" type="number" step=".01" min="0" placeholder="Leave blank if none" value={zone.freeDeliveryMinimumPence==null?"":(zone.freeDeliveryMinimumPence/100).toFixed(2)} onChange={(e)=>patchZone(index,{freeDeliveryMinimumPence:e.target.value===""?null:Math.round(Number(e.target.value)*100)})}/></label>
              </div>
            </div>
            <div className="admin-method-card">
              <div className="admin-switch-row"><div><strong>Collection method</strong><small>Mirrors the Woo zone method for operational visibility.</small></div><button className={zone.collectionEnabled?"admin-switch on":"admin-switch"} onClick={()=>patchZone(index,{collectionEnabled:!zone.collectionEnabled})}></button></div>
              <p className="admin-help">Collection is not postcode-restricted at customer checkout; the global Collection switch controls whether it is offered.</p>
            </div>
          </div>

          {!zone.id.startsWith("woo-4")&&<button className="admin-danger" onClick={()=>removeZone(index)}>Remove zone</button>}
        </div>)}
      </div>
    </section>

    <div className="admin-panel" style={{gridColumn:"1/-1"}}>
      {message&&<div className={message.includes("saved")?"admin-alert success":"admin-alert danger"}>{message}</div>}
      <div className="admin-toolbar"><button className="admin-primary" disabled={saving} onClick={save}>{saving?"Saving…":"Save shipping zones"}</button><span className="admin-muted">Checkout picks up these rules immediately.</span></div>
    </div>
  </div>;
}
