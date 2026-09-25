"use client";
import { useMemo,useState } from "react";

type Row={
  id:string;email:string;first_name:string;last_name:string;phone:string|null;enabled:boolean;email_verified:boolean;
  created_at:string;last_login_at:string|null;orders_count:number;spend_pence:number;active_subscriptions:number;
};

export function AdminCustomersClient({initialRows}:{initialRows:Row[]}){
  const [rows,setRows]=useState(initialRows);
  const [query,setQuery]=useState("");
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  const filtered=useMemo(()=>rows.filter((row)=>[row.first_name,row.last_name,row.email,row.phone].join(" ").toLowerCase().includes(query.toLowerCase())),[rows,query]);

  async function toggle(row:Row){
    setBusy(row.id);setMessage("");
    try{
      const response=await fetch("/api/admin/customers/"+row.id,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({enabled:!row.enabled})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to update customer");
      setRows((current)=>current.map((item)=>item.id===row.id?{...item,enabled:!item.enabled}:item));
      setMessage((!row.enabled?"Customer access enabled.":"Customer access disabled."));
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to update customer");}
    finally{setBusy("");}
  }

  return <div className="admin-panel">
    <div className="admin-toolbar">
      <input className="admin-input" style={{maxWidth:360}} placeholder="Search name, email or phone…" value={query} onChange={(e)=>setQuery(e.target.value)}/>
      <span className="admin-muted">{filtered.length} registered customers</span>
    </div>
    {message&&<div className={message.includes("enabled")||message.includes("disabled")?"admin-alert success":"admin-alert danger"} style={{marginTop:12}}>{message}</div>}
    <div className="admin-table-wrap" style={{marginTop:14}}><table className="admin-table"><thead><tr><th>Customer</th><th>Orders</th><th>Spend</th><th>Subscriptions</th><th>Last login</th><th>Access</th></tr></thead><tbody>
      {filtered.map((row)=><tr key={row.id}>
        <td><strong>{[row.first_name,row.last_name].filter(Boolean).join(" ")||"Customer"}</strong><small>{row.email}<br/>{row.phone||""}</small></td>
        <td>{row.orders_count}</td>
        <td>£{(Number(row.spend_pence||0)/100).toFixed(2)}</td>
        <td>{row.active_subscriptions}</td>
        <td>{row.last_login_at?new Date(row.last_login_at).toLocaleString("en-GB"):"Never"}</td>
        <td><div className="admin-toolbar"><span className={row.enabled?"admin-badge active":"admin-badge cancelled"}>{row.enabled?"Enabled":"Disabled"}</span><button className={row.enabled?"admin-danger":"admin-secondary"} disabled={busy===row.id} onClick={()=>toggle(row)}>{row.enabled?"Disable":"Enable"}</button></div></td>
      </tr>)}
      {!filtered.length&&<tr><td colSpan={6}><div className="admin-empty">No matching registered customers.</div></td></tr>}
    </tbody></table></div>
  </div>;
}
