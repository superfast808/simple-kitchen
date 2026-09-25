"use client";
import { useMemo,useState } from "react";

type Row={
  id:string;created_at:string;updated_at:string;status:string;stripe_subscription_id:string|null;source?:string;woo_subscription_id?:number|null;
  customer_email:string;customer_name:string;meals_per_week:number;fulfilment:string;
  cadence_weeks:number;source_plan:string;selection_token:string;selection_count:number;history_count?:number;
};

export function AdminSubscriptionsClient({initialRows}:{initialRows:Row[]}){
  const [rows,setRows]=useState(initialRows);
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("all");
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState("");

  const filtered=useMemo(()=>rows.filter((row)=>{
    const hay=[row.customer_name,row.customer_email,row.stripe_subscription_id,row.woo_subscription_id,row.source_plan,row.source].join(" ").toLowerCase();
    return (!query||hay.includes(query.toLowerCase()))&&(status==="all"||row.status===status);
  }),[rows,query,status]);

  async function action(row:Row,action:"cancel"|"resend"){
    if(action==="cancel"&&row.source!=="stripe") return;
    if(action==="cancel"&&!confirm("Cancel this subscription in Stripe? This is a real billing action and cannot be undone.")) return;
    setBusy(row.id);setMessage("");
    try{
      const response=await fetch("/api/admin/subscriptions/"+row.id,{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action})
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Action failed");
      if(action==="cancel") setRows((current)=>current.map((item)=>item.id===row.id?{...item,status:"cancelled"}:item));
      setMessage(action==="cancel"?"Subscription cancelled in Stripe.":"Selection link sent.");
    }catch(error){setMessage(error instanceof Error?error.message:"Action failed");}
    finally{setBusy(null);}
  }

  return <div className="admin-panel">
    <div className="admin-toolbar">
      <input className="admin-input" style={{maxWidth:320}} placeholder="Search subscriber…" value={query} onChange={(e)=>setQuery(e.target.value)}/>
      <select className="admin-input" style={{maxWidth:180}} value={status} onChange={(e)=>setStatus(e.target.value)}>
        <option value="all">All statuses</option><option value="active">Active</option><option value="cancelled">Cancelled</option><option value="paused">Paused</option>
      </select>
      <span className="admin-muted">{filtered.length} subscriptions</span>
    </div>
    {message&&<div className={message.includes("failed")||message.includes("Unable")?"admin-alert danger":"admin-alert success"} style={{marginTop:12}}>{message}</div>}
    <div className="admin-table-wrap" style={{marginTop:14}}><table className="admin-table"><thead><tr><th>Subscriber</th><th>Plan</th><th>Meals</th><th>Fulfilment</th><th>Status</th><th>Selections</th><th>History</th><th></th></tr></thead><tbody>
      {filtered.map((row)=><tr key={row.id}>
        <td><strong>{row.customer_name||"Subscriber"}</strong><small>{row.customer_email}</small></td>
        <td><strong>{row.source_plan.replaceAll("-"," ")}</strong><small>{row.source==="woo"?"Woo legacy #"+(row.woo_subscription_id||""):(row.cadence_weeks===2?"Every 2 weeks":row.source_plan==="twice-weekly"?"2 fulfilments / week":"Weekly")}</small></td>
        <td>{row.meals_per_week}</td>
        <td style={{textTransform:"capitalize"}}>{row.fulfilment}</td>
        <td><span className={"admin-badge "+row.status}>{row.status}</span></td>
        <td>{row.selection_count}</td><td>{row.history_count||0}</td>
        <td><div className="admin-toolbar">
          <button className="admin-secondary" disabled={busy===row.id||row.status!=="active"} onClick={()=>action(row,"resend")}>Send link</button>
          {row.status==="active"&&row.source==="stripe"&&row.stripe_subscription_id&&<button className="admin-danger" disabled={busy===row.id} onClick={()=>action(row,"cancel")}>Cancel</button>}
        </div></td>
      </tr>)}
      {!filtered.length&&<tr><td colSpan={8}><div className="admin-empty">No matching subscriptions.</div></td></tr>}
    </tbody></table></div>
  </div>;
}
