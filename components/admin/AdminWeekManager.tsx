"use client";
import { useState } from "react";

type Initial={
  cycleStartDate:string;menuForceState:"auto"|"open"|"closed";
  menuOpenDay:number;menuOpenHour:number;menuOpenMinute:number;
  menuCloseDay:number;menuCloseHour:number;menuCloseMinute:number;
  fulfilmentOffsetDays:number;
};
type Preview={week:number;opens:string;closes:string;fulfilmentDate:string};

const days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
function timeValue(hour:number,minute:number){return String(hour).padStart(2,"0")+":"+String(minute).padStart(2,"0");}
function parseTime(value:string){const [h,m]=value.split(":").map(Number);return {hour:h||0,minute:m||0};}

export function AdminWeekManager({initial,preview,currentWeek,currentOpen,scheduleLabel}:{initial:Initial;preview:Preview[];currentWeek:number;currentOpen:boolean;scheduleLabel:string}){
  const [value,setValue]=useState(initial);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  function patch(patch:Partial<Initial>){setValue((current)=>({...current,...patch}));}

  async function save(){
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/admin/weeks",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(value)});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to save schedule");
      setMessage("Week schedule saved. Refreshing preview…");
      window.setTimeout(()=>window.location.reload(),700);
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to save schedule");setSaving(false);}
  }

  return <div className="admin-section-grid">
    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Current cycle</h2><p>{scheduleLabel}</p></div><span className={currentOpen?"admin-status live":"admin-status"}><span></span>{currentOpen?"Open":"Closed"} · Week {currentWeek}</span></div>
      <div className="admin-form">
        <label>Week 1 anchor date<input type="date" value={value.cycleStartDate} onChange={(e)=>patch({cycleStartDate:e.target.value})}/><span className="admin-help">The opening date that defines Week 1 of the repeating six-week cycle.</span></label>
        <label>Ordering state<select value={value.menuForceState} onChange={(e)=>patch({menuForceState:e.target.value as Initial["menuForceState"]})}><option value="auto">Automatic schedule</option><option value="open">Force open</option><option value="closed">Force closed</option></select><span className="admin-help">Use manual states only for exceptional situations, then return to Automatic.</span></label>
      </div>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Ordering window</h2><p>Default remains Saturday noon → Wednesday 23:59.</p></div></div>
      <div className="admin-form-grid">
        <label>Opens on<select value={value.menuOpenDay} onChange={(e)=>patch({menuOpenDay:Number(e.target.value)})}>{days.map((day,index)=><option value={index+1} key={day}>{day}</option>)}</select></label>
        <label>Opening time<input type="time" value={timeValue(value.menuOpenHour,value.menuOpenMinute)} onChange={(e)=>{const t=parseTime(e.target.value);patch({menuOpenHour:t.hour,menuOpenMinute:t.minute});}}/></label>
        <label>Closes on<select value={value.menuCloseDay} onChange={(e)=>patch({menuCloseDay:Number(e.target.value)})}>{days.map((day,index)=><option value={index+1} key={day}>{day}</option>)}</select></label>
        <label>Closing time<input type="time" value={timeValue(value.menuCloseHour,value.menuCloseMinute)} onChange={(e)=>{const t=parseTime(e.target.value);patch({menuCloseHour:t.hour,menuCloseMinute:t.minute});}}/></label>
        <label className="wide">Fulfilment offset (days after opening)<input type="number" min="0" max="21" value={value.fulfilmentOffsetDays} onChange={(e)=>patch({fulfilmentOffsetDays:Number(e.target.value)})}/><span className="admin-help">Current behavior is 7 days after the menu opens.</span></label>
      </div>
    </section>

    <section className="admin-panel" style={{gridColumn:"1/-1"}}>
      <div className="admin-panel-head"><div><h2>Six-week forward calendar</h2><p>Preview generated from the saved schedule.</p></div></div>
      <div className="admin-week-grid">{preview.map((item,index)=><div className="admin-week-card" key={item.opens}>
        <div className="admin-week-number">Week {item.week}</div>
        <strong>{new Date(item.opens).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}</strong>
        <small>Opens {new Date(item.opens).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</small>
        <small>Closes {new Date(item.closes).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})} · {new Date(item.closes).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</small>
        <span>Fulfilment {new Date(item.fulfilmentDate+"T12:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}</span>
        {index===0&&<b>Next/current window</b>}
      </div>)}</div>
    </section>

    <section className="admin-panel" style={{gridColumn:"1/-1"}}>
      {message&&<div className={message.includes("saved")?"admin-alert success":"admin-alert danger"}>{message}</div>}
      <div className="admin-toolbar"><button className="admin-primary" disabled={saving} onClick={save}>{saving?"Saving…":"Save week schedule"}</button><span className="admin-muted">Changes affect menu availability, capacity cycle keys, subscription selections and fulfilment dates.</span></div>
    </section>
  </div>;
}
