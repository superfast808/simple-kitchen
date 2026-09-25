"use client";
import { useMemo,useState } from "react";

type ProductOption={id:string;name:string};
type Coupon={
  id:string;woo_id:number|null;code:string;description:string|null;discount_type:"percent"|"fixed_cart"|"fixed_product";
  amount:string|number;enabled:boolean;expiry_at:string|null;minimum_amount_pence:number;maximum_amount_pence:number|null;
  usage_limit:number|null;usage_limit_per_customer:number|null;limit_usage_to_x_items:number|null;individual_use:boolean;
  free_shipping:boolean;product_ids:string[];excluded_product_ids:string[];categories:string[];excluded_categories:string[];
  exclude_sale_items:boolean;allowed_emails:string[];source:string;redemption_count:number;discount_total_pence:number;
  gift_delivered_at?:string|null;gift_recipient_email?:string|null;gift_order_id?:string|null;
};

const categories=[
  ["18","Week 1"],["19","Week 2"],["28","Week 3"],["29","Week 4"],["30","Week 5"],["31","Week 6"],
  ["27","Gift Card"],["24","Subscription"],["34","Add Delivery"],["36","Christmas"],["38","Specialities"]
];

function emptyCoupon():Coupon{
  return {
    id:"",woo_id:null,code:"",description:"",discount_type:"percent",amount:10,enabled:true,expiry_at:null,
    minimum_amount_pence:0,maximum_amount_pence:null,usage_limit:null,usage_limit_per_customer:null,
    limit_usage_to_x_items:null,individual_use:false,free_shipping:false,product_ids:[],excluded_product_ids:[],
    categories:[],excluded_categories:[],exclude_sale_items:false,allowed_emails:[],source:"admin",
    redemption_count:0,discount_total_pence:0
  };
}

export function AdminCouponsClient({initialRows,products}:{initialRows:Coupon[];products:ProductOption[]}){
  const [rows,setRows]=useState(initialRows);
  const [selected,setSelected]=useState<Coupon|null>(null);
  const [query,setQuery]=useState("");
  const [source,setSource]=useState("all");
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  const filtered=useMemo(()=>rows.filter((coupon)=>{
    const match=!query||[coupon.code,coupon.description,coupon.source].join(" ").toLowerCase().includes(query.toLowerCase());
    return match&&(source==="all"||coupon.source===source);
  }),[rows,query,source]);

  function patch(patch:Partial<Coupon>){setSelected((current)=>current?{...current,...patch}:current);}
  function nullableNumber(value:string){return value===""?null:Number(value);}

  function toggleArray(field:"categories"|"excluded_categories",value:string){
    if(!selected) return;
    const current=selected[field]||[];
    patch({[field]:current.includes(value)?current.filter((item)=>item!==value):[...current,value]} as Partial<Coupon>);
  }

  async function save(){
    if(!selected) return;
    setBusy("save");setMessage("");
    try{
      const response=await fetch("/api/admin/coupons",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify(selected)
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to save coupon");
      setRows((current)=>{
        const exists=current.some((row)=>row.id===data.coupon.id);
        return exists?current.map((row)=>row.id===data.coupon.id?{...row,...data.coupon}:row):[data.coupon,...current];
      });
      setSelected({...selected,...data.coupon});
      setMessage("Coupon saved and live.");
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to save coupon");}
    finally{setBusy("");}
  }

  async function remove(coupon:Coupon){
    if(!confirm(coupon.redemption_count>0?"This coupon has usage history. It will be disabled rather than deleted. Continue?":"Delete this coupon?")) return;
    setBusy(coupon.id);setMessage("");
    try{
      const response=await fetch("/api/admin/coupons/"+coupon.id,{method:"DELETE"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to remove coupon");
      if(data.result==="deleted") setRows((current)=>current.filter((row)=>row.id!==coupon.id));
      else setRows((current)=>current.map((row)=>row.id===coupon.id?{...row,enabled:false}:row));
      if(selected?.id===coupon.id) setSelected(null);
      setMessage(data.result==="deleted"?"Coupon deleted.":"Coupon disabled to preserve redemption history.");
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to remove coupon");}
    finally{setBusy("");}
  }

  async function resendGift(coupon:Coupon){
    setBusy("gift-"+coupon.id);setMessage("");
    try{
      const response=await fetch("/api/admin/coupons/"+coupon.id+"/resend-gift",{method:"POST"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to resend gift card");
      const deliveredAt=data.deliveredAt||new Date().toISOString();
      setRows((current)=>current.map((row)=>row.id===coupon.id?{...row,gift_delivered_at:deliveredAt}:row));
      setSelected((current)=>current?.id===coupon.id?{...current,gift_delivered_at:deliveredAt}:current);
      setMessage("Gift card emailed to "+data.recipient+".");
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to resend gift card");}
    finally{setBusy("");}
  }

  async function syncWoo(){
    setBusy("sync");setMessage("");
    try{
      const response=await fetch("/api/admin/coupons/import-woo",{method:"POST"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Woo sync failed");
      setRows(data.coupons);
      setSelected(null);
      setMessage("Woo coupons synced: "+data.imported+" imported/updated.");
    }catch(error){setMessage(error instanceof Error?error.message:"Woo sync failed");}
    finally{setBusy("");}
  }

  return <div className="admin-coupon-layout">
    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Codes</h2><p>Woo coupons, admin codes and issued gift cards.</p></div><div className="admin-toolbar"><button className="admin-secondary" disabled={busy==="sync"} onClick={syncWoo}>{busy==="sync"?"Syncing…":"↻ Sync Woo"}</button><button className="admin-primary" onClick={()=>setSelected(emptyCoupon())}>+ New coupon</button></div></div>
      <div className="admin-toolbar">
        <input className="admin-input" placeholder="Search code or description…" value={query} onChange={(e)=>setQuery(e.target.value)}/>
        <select className="admin-input" value={source} onChange={(e)=>setSource(e.target.value)} style={{maxWidth:160}}><option value="all">All sources</option><option value="woo">WooCommerce</option><option value="admin">Admin</option><option value="gift_card">Gift cards</option></select>
      </div>
      <div className="admin-coupon-list">
        {filtered.map((coupon)=><button key={coupon.id} className={selected?.id===coupon.id?"admin-coupon-row selected":"admin-coupon-row"} onClick={()=>setSelected({...coupon})}>
          <div><strong>{coupon.code}</strong><small>{coupon.description||coupon.source.replace("_"," ")}</small></div>
          <div><strong>{coupon.source==="gift_card"?"£"+Number(coupon.amount).toFixed(2)+" balance":coupon.discount_type==="percent"?Number(coupon.amount)+"%":"£"+Number(coupon.amount).toFixed(2)}</strong><small>{coupon.redemption_count} uses</small></div>
          <span className={coupon.enabled?"admin-badge active":"admin-badge cancelled"}>{coupon.enabled?"Active":"Disabled"}</span>
        </button>)}
        {!filtered.length&&<div className="admin-empty">No matching coupon codes.</div>}
      </div>
    </section>

    <section className="admin-panel admin-coupon-editor">
      {!selected?<div className="admin-empty"><h3>Select a code</h3><p>Edit an existing coupon or create a new one.</p></div>:<>
        <div className="admin-panel-head"><div><h2>{selected.id?selected.code:"New coupon"}</h2><p>{selected.source==="gift_card"?"Stored-value e-gift card":"Commerce discount rule"}</p></div>{selected.id&&<span className="admin-badge">{selected.source}</span>}</div>
        {selected.source==="gift_card"?<>
          <div className="admin-alert success">Gift-card balance is transactional and protected. You can disable the code, but its balance is changed only by confirmed redemptions.</div>
          <div className="admin-card-row">
            <div><strong>E-delivery</strong><small>{selected.gift_recipient_email||"Recipient email unavailable"} · {selected.gift_delivered_at?"Delivered "+new Date(selected.gift_delivered_at).toLocaleString("en-GB"):"Not yet marked delivered"}</small></div>
            <button className="admin-secondary" disabled={busy==="gift-"+selected.id||!selected.gift_recipient_email} onClick={()=>resendGift(selected)}>{busy==="gift-"+selected.id?"Sending…":"Resend e-gift"}</button>
          </div>
        </>:null}
        <div className="admin-form">
          <div className="admin-switch-row"><div><strong>Enabled</strong><small>Disabled codes cannot be applied at checkout.</small></div><button className={selected.enabled?"admin-switch on":"admin-switch"} onClick={()=>patch({enabled:!selected.enabled})}></button></div>
          <div className="admin-form-grid">
            <label>Code<input value={selected.code} disabled={selected.source==="gift_card"} onChange={(e)=>patch({code:e.target.value.toUpperCase().replace(/\s+/g,"")})}/></label>
            <label>Type<select value={selected.discount_type} disabled={selected.source==="gift_card"} onChange={(e)=>patch({discount_type:e.target.value as Coupon["discount_type"]})}><option value="percent">Percentage</option><option value="fixed_cart">Fixed basket</option><option value="fixed_product">Fixed per product</option></select></label>
            <label>{selected.source==="gift_card"?"Remaining balance (£)":selected.discount_type==="percent"?"Discount (%)":"Discount (£)"}<input type="number" min="0" step=".01" disabled={selected.source==="gift_card"} value={Number(selected.amount)} onChange={(e)=>patch({amount:Number(e.target.value)})}/></label>
            <label>Expiry<input type="datetime-local" value={selected.expiry_at?new Date(selected.expiry_at).toISOString().slice(0,16):""} onChange={(e)=>patch({expiry_at:e.target.value?new Date(e.target.value).toISOString():null})}/></label>
          </div>
          <label>Description<textarea rows={2} value={selected.description||""} onChange={(e)=>patch({description:e.target.value})}/></label>

          {selected.source!=="gift_card"&&<>
            <h3>Spend & usage limits</h3>
            <div className="admin-form-grid three">
              <label>Minimum spend (£)<input type="number" min="0" step=".01" value={(selected.minimum_amount_pence/100).toFixed(2)} onChange={(e)=>patch({minimum_amount_pence:Math.round(Number(e.target.value)*100)})}/></label>
              <label>Maximum spend (£)<input type="number" min="0" step=".01" value={selected.maximum_amount_pence==null?"":(selected.maximum_amount_pence/100).toFixed(2)} onChange={(e)=>patch({maximum_amount_pence:e.target.value===""?null:Math.round(Number(e.target.value)*100)})}/></label>
              <label>Global usage limit<input type="number" min="1" value={selected.usage_limit??""} onChange={(e)=>patch({usage_limit:nullableNumber(e.target.value)})}/></label>
              <label>Per-customer limit<input type="number" min="1" value={selected.usage_limit_per_customer??""} onChange={(e)=>patch({usage_limit_per_customer:nullableNumber(e.target.value)})}/></label>
              <label>Limit discounted items<input type="number" min="1" value={selected.limit_usage_to_x_items??""} onChange={(e)=>patch({limit_usage_to_x_items:nullableNumber(e.target.value)})}/></label>
            </div>
            <div className="admin-switch-row"><div><strong>Free shipping</strong><small>For an eligible delivery-zone order, delivery charge becomes £0.</small></div><button className={selected.free_shipping?"admin-switch on":"admin-switch"} onClick={()=>patch({free_shipping:!selected.free_shipping})}></button></div>
            <div className="admin-switch-row"><div><strong>Individual use</strong><small>Preserved from Woo. The new checkout currently supports one code per order.</small></div><button className={selected.individual_use?"admin-switch on":"admin-switch"} onClick={()=>patch({individual_use:!selected.individual_use})}></button></div>

            <h3>Product restrictions</h3>
            <div className="admin-form-grid">
              <label>Included products<select multiple size={6} value={selected.product_ids} onChange={(e)=>patch({product_ids:Array.from(e.target.selectedOptions).map((option)=>option.value)})}>{products.map((product)=><option value={product.id} key={product.id}>{product.name}</option>)}</select><span className="admin-help">Leave empty for all products.</span></label>
              <label>Excluded products<select multiple size={6} value={selected.excluded_product_ids} onChange={(e)=>patch({excluded_product_ids:Array.from(e.target.selectedOptions).map((option)=>option.value)})}>{products.map((product)=><option value={product.id} key={product.id}>{product.name}</option>)}</select></label>
            </div>

            <h3>Category restrictions</h3>
            <div className="admin-category-grid">{categories.map(([id,label])=><div key={id} className="admin-category-rule"><strong>{label}</strong><label><input type="checkbox" checked={selected.categories.includes(id)} onChange={()=>toggleArray("categories",id)}/> Include</label><label><input type="checkbox" checked={selected.excluded_categories.includes(id)} onChange={()=>toggleArray("excluded_categories",id)}/> Exclude</label></div>)}</div>

            <label>Email restrictions<input value={selected.allowed_emails.join(", ")} onChange={(e)=>patch({allowed_emails:e.target.value.split(",").map((item)=>item.trim()).filter(Boolean)})}/><span className="admin-help">Comma-separated addresses or Woo-style wildcards, e.g. *@company.org.</span></label>
          </>}

          <div className="admin-coupon-stats"><div><small>Uses</small><strong>{selected.redemption_count}</strong></div><div><small>Discount given since migration</small><strong>£{(selected.discount_total_pence/100).toFixed(2)}</strong></div>{selected.woo_id&&<div><small>Woo ID</small><strong>#{selected.woo_id}</strong></div>}</div>
          {message&&<div className={message.includes("saved")||message.includes("synced")||message.includes("disabled")||message.includes("deleted")?"admin-alert success":"admin-alert danger"}>{message}</div>}
          <div className="admin-toolbar"><button className="admin-primary" disabled={busy==="save"||!selected.code} onClick={save}>{busy==="save"?"Saving…":"Save code"}</button>{selected.id&&<button className="admin-danger" disabled={busy===selected.id} onClick={()=>remove(selected)}>{selected.source==="gift_card"?"Disable / remove":"Delete / disable"}</button>}</div>
        </div>
      </>}
    </section>
  </div>;
}
