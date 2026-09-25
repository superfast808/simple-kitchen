"use client";
import { useState } from "react";

type Candidate={phone:string;email:string;firstName:string;lastName:string;lastOrderAt:string;message:string};
type Initial={
  smsEnabled:boolean;smsLookbackDays:number;smsMessage:string;smsDay:number;smsHour:number;smsMinute:number;
  clicksendUsername:string;clicksendFrom:string;clicksendConfigured:boolean;
  smtpHost:string;smtpPort:number;smtpSecure:boolean;smtpUser:string;smtpFrom:string;smtpConfigured:boolean;
  candidates:Candidate[];
};

export function AdminMessagingClient({initial,adminEmail}:{initial:Initial;adminEmail:string}){
  const [value,setValue]=useState(initial);
  const [clicksendKey,setClicksendKey]=useState("");
  const [smtpPass,setSmtpPass]=useState("");
  const [saving,setSaving]=useState(false);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  function patch(patch:Partial<Initial>){setValue((current)=>({...current,...patch}));}

  async function save(){
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/admin/messaging",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...value,clicksendApiKey:clicksendKey,smtpPass})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Save failed");
      setClicksendKey("");setSmtpPass("");
      setValue((current)=>({...current,clicksendConfigured:data.clicksendConfigured,smtpConfigured:data.smtpConfigured}));
      setMessage("Messaging settings saved.");
    }catch(error){setMessage(error instanceof Error?error.message:"Save failed");}
    finally{setSaving(false);}
  }

  async function smsAction(action:"preview"|"send"){
    if(action==="send"&&!confirm("Send the weekly SMS reminder to the current eligible audience now?")) return;
    setBusy(action);setMessage("");
    try{
      const response=await fetch("/api/admin/messaging/sms",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"SMS action failed");
      if(action==="preview") patch({candidates:data.candidates||[]});
      else patch({candidates:[]});
      setMessage(action==="preview"?"SMS audience refreshed.":"SMS batch completed: "+data.sent+" sent, "+data.failed+" failed.");
    }catch(error){setMessage(error instanceof Error?error.message:"SMS action failed");}
    finally{setBusy("");}
  }

  async function testEmail(){
    setBusy("email");setMessage("");
    try{
      const response=await fetch("/api/admin/messaging/test-email",{method:"POST"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Test failed");
      setMessage("Test email sent to "+adminEmail+".");
    }catch(error){setMessage(error instanceof Error?error.message:"Test failed");}
    finally{setBusy("");}
  }

  return <div className="admin-section-grid">
    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Weekly SMS reminder</h2><p>ClickSend audience logic and schedule.</p></div><span className={value.clicksendConfigured?"admin-secret-state configured":"admin-secret-state"}>{value.clicksendConfigured?"ClickSend ready":"ClickSend not configured"}</span></div>
      <div className="admin-switch-row"><div><strong>Automatic reminders</strong><small>Eligible customers only; subscribers and this-week purchasers are excluded.</small></div><button className={value.smsEnabled?"admin-switch on":"admin-switch"} onClick={()=>patch({smsEnabled:!value.smsEnabled})}></button></div>
      <div className="admin-form" style={{marginTop:16}}>
        <div className="admin-form-grid three">
          <label>Lookback days<input type="number" min="1" max="365" value={value.smsLookbackDays} onChange={(e)=>patch({smsLookbackDays:Number(e.target.value)})}/></label>
          <label>Day<select value={value.smsDay} onChange={(e)=>patch({smsDay:Number(e.target.value)})}>{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day,index)=><option key={day} value={index+1}>{day}</option>)}</select></label>
          <label>Time<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><input type="number" min="0" max="23" value={value.smsHour} onChange={(e)=>patch({smsHour:Number(e.target.value)})}/><input type="number" min="0" max="59" value={value.smsMinute} onChange={(e)=>patch({smsMinute:Number(e.target.value)})}/></div></label>
        </div>
        <label>SMS text<textarea rows={4} value={value.smsMessage} onChange={(e)=>patch({smsMessage:e.target.value})}/><span className="admin-help">Tokens: {"{first_name}"} {"{last_name}"} {"{shop_name}"} {"{shop_url}"}</span></label>
        <div className="admin-form-grid">
          <label>ClickSend username<input value={value.clicksendUsername} onChange={(e)=>patch({clicksendUsername:e.target.value})}/></label>
          <label>Sender / from<input value={value.clicksendFrom} onChange={(e)=>patch({clicksendFrom:e.target.value})}/></label>
          <label className="wide">ClickSend API key<input type="password" placeholder={value.clicksendConfigured?"Stored securely — enter only to replace":"Enter API key"} value={clicksendKey} onChange={(e)=>setClicksendKey(e.target.value)}/></label>
        </div>
        <div className="admin-toolbar"><button className="admin-secondary" disabled={busy==="preview"} onClick={()=>smsAction("preview")}>{busy==="preview"?"Refreshing…":"Refresh preview"}</button><button className="admin-danger" disabled={busy==="send"||!value.clicksendConfigured} onClick={()=>smsAction("send")}>Send now</button></div>
      </div>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Email / SMTP</h2><p>Subscription links and operational email.</p></div><span className={value.smtpConfigured?"admin-secret-state configured":"admin-secret-state"}>{value.smtpConfigured?"SMTP ready":"SMTP not configured"}</span></div>
      <div className="admin-form">
        <div className="admin-form-grid">
          <label>SMTP host<input value={value.smtpHost} onChange={(e)=>patch({smtpHost:e.target.value})}/></label>
          <label>Port<input type="number" value={value.smtpPort} onChange={(e)=>patch({smtpPort:Number(e.target.value)})}/></label>
          <label>Username<input value={value.smtpUser} onChange={(e)=>patch({smtpUser:e.target.value})}/></label>
          <label>From address<input value={value.smtpFrom} onChange={(e)=>patch({smtpFrom:e.target.value})}/></label>
          <label>SMTP password<input type="password" placeholder={value.smtpConfigured?"Stored securely — enter only to replace":"Enter SMTP password"} value={smtpPass} onChange={(e)=>setSmtpPass(e.target.value)}/></label>
          <label>Encryption<select value={value.smtpSecure?"ssl":"starttls"} onChange={(e)=>patch({smtpSecure:e.target.value==="ssl"})}><option value="starttls">STARTTLS / port 587</option><option value="ssl">SSL / port 465</option></select></label>
        </div>
        <button className="admin-secondary" disabled={busy==="email"||!value.smtpConfigured} onClick={testEmail}>{busy==="email"?"Sending…":"Send test email to me"}</button>
      </div>
    </section>

    <section className="admin-panel" style={{gridColumn:"1/-1"}}>
      <div className="admin-panel-head"><div><h2>Current SMS audience preview</h2><p>{value.candidates.length} eligible recipients after lookback, current-week order and subscriber exclusions.</p></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Last order</th><th>Message</th></tr></thead><tbody>
        {value.candidates.slice(0,100).map((row,index)=><tr key={row.phone+"-"+index}><td>{[row.firstName,row.lastName].filter(Boolean).join(" ")||"Customer"}</td><td>{row.phone}</td><td>{row.email}</td><td>{row.lastOrderAt?new Date(row.lastOrderAt).toLocaleDateString("en-GB"):"—"}</td><td><small>{row.message}</small></td></tr>)}
        {!value.candidates.length&&<tr><td colSpan={5}><div className="admin-empty">No eligible SMS recipients at present.</div></td></tr>}
      </tbody></table></div>
    </section>

    <section className="admin-panel" style={{gridColumn:"1/-1"}}>
      {message&&<div className={message.includes("failed")||message.includes("not")?"admin-alert danger":"admin-alert success"}>{message}</div>}
      <button className="admin-primary" disabled={saving} onClick={save}>{saving?"Saving…":"Save messaging settings"}</button>
    </section>
  </div>;
}
