"use client";
import { useMemo,useState } from "react";

type Row={
  id:string;created_at:string;status:string;fulfilment:string;total_pence:number;shipping_pence:number;
  customer:Record<string,string>;stripe_session_id?:string|null;source?:string;woo_order_id?:number|null;woo_order_number?:string|null;payment_method_title?:string|null;items?:{name:string;quantity:number;unit_price_pence:number}[];
};

export function AdminOrdersClient({initialRows}:{initialRows:Row[]}){
  const [rows,setRows]=useState(initialRows);
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("all");
  const [expanded,setExpanded]=useState<string|null>(null);
  const [saving,setSaving]=useState<string|null>(null);
  const [message,setMessage]=useState("");

  const filtered=useMemo(()=>rows.filter((row)=>{
    const hay=[row.customer?.name,row.customer?.email,row.customer?.phone,row.id,row.woo_order_id,row.woo_order_number].join(" ").toLowerCase();
    return (!query||hay.includes(query.toLowerCase()))&&(status==="all"||row.status===status);
  }),[rows,query,status]);

  async function updateStatus(id:string,next:string){
    setSaving(id);setMessage("");
    try{
      const response=await fetch("/api/admin/orders/"+id,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status:next})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Update failed");
      setRows((current)=>current.map((row)=>row.id===id?{...row,status:next}:row));
      setMessage("Order updated.");
    }catch(error){setMessage(error instanceof Error?error.message:"Update failed");}
    finally{setSaving(null);}
  }

  return <div className="admin-panel">
    <div className="admin-toolbar">
      <input className="admin-input" style={{maxWidth:320}} placeholder="Search customer, phone, email or order…" value={query} onChange={(e)=>setQuery(e.target.value)}/>
      <select className="admin-input" style={{maxWidth:180}} value={status} onChange={(e)=>setStatus(e.target.value)}>
        <option value="all">All statuses</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="on_hold">On hold</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option>
      </select>
      <span className="admin-muted">{filtered.length} orders</span>
    </div>
    {message&&<div className={message.includes("updated")?"admin-alert success":"admin-alert danger"}>{message}</div>}
    <div className="admin-table-wrap" style={{marginTop:14}}><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Fulfilment</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>
      {filtered.map((row)=><>
        <tr key={row.id}>
          <td><strong>{new Date(row.created_at).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</strong><small>{row.source==="woo"?"Woo #"+(row.woo_order_number||row.woo_order_id):row.id.slice(0,8)}</small></td>
          <td><strong>{row.customer?.name||"Customer"}</strong><small>{row.customer?.email||""}<br/>{row.customer?.phone||""}</small></td>
          <td style={{textTransform:"capitalize"}}>{row.fulfilment}</td>
          <td><strong>£{(Number(row.total_pence)/100).toFixed(2)}</strong><small>{row.shipping_pence?"incl. £"+(row.shipping_pence/100).toFixed(2)+" delivery":"No delivery charge"}</small></td>
          <td><select className="admin-input" value={row.status} disabled={saving===row.id} onChange={(e)=>updateStatus(row.id,e.target.value)} style={{minWidth:130}}>
            {["pending","paid","processing","completed","on_hold","failed","cancelled","expired"].map((value)=><option value={value} key={value}>{value.replace("_"," ")}</option>)}
          </select></td>
          <td><button className="admin-secondary" onClick={()=>setExpanded(expanded===row.id?null:row.id)}>{expanded===row.id?"Hide":"View"}</button></td>
        </tr>
        {expanded===row.id&&<tr key={row.id+"-detail"}><td colSpan={6}><div className="admin-order-detail">
          <div><strong>Items</strong>{(row.items||[]).map((item,index)=><div key={index}>{item.quantity} × {item.name} <small>£{(item.unit_price_pence/100).toFixed(2)} each</small></div>)}</div>
          <div><strong>Address / contact</strong><div>{row.customer?.address1||""}</div><div>{row.customer?.address2||""}</div><div>{row.customer?.city||""} {row.customer?.postcode||""}</div></div>
          <div><strong>{row.source==="woo"?"Payment source":"Stripe"}</strong><div className="admin-muted">{row.source==="woo"?(row.payment_method_title||"WooCommerce"):row.stripe_session_id||"No Stripe session"}</div></div>
        </div></td></tr>}
      </>)}
      {!filtered.length&&<tr><td colSpan={6}><div className="admin-empty">No matching orders.</div></td></tr>}
    </tbody></table></div>
  </div>;
}
