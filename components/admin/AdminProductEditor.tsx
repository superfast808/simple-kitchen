"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminProductMedia } from "./AdminProductMedia";

type Media={id:string;urlPath:string;altText:string;sortOrder:number;isPrimary:boolean;source:string};
type ProductEditorItem={
  id:string;name:string;description:string;longDescription:string;ingredients:string;price:number;category:string;week:number|null;
  image:string;enabled:boolean;isCustom:boolean;canReset:boolean;hasOverride:boolean;media:Media[];
};

export function AdminProductEditor({initial}:{initial:ProductEditorItem}){
  const router=useRouter();
  const [item,setItem]=useState(initial);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  function patch(patch:Partial<ProductEditorItem>){setItem((current)=>({...current,...patch}));}

  async function save(){
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/admin/products/"+encodeURIComponent(item.id),{
        method:"PATCH",headers:{"content-type":"application/json"},
        body:JSON.stringify({
          enabled:item.enabled,name:item.name,description:item.description,longDescription:item.longDescription,ingredients:item.ingredients,
          pricePence:Math.round(Number(item.price)*100),category:item.category,week:item.week,image:item.image||""
        })
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Save failed");
      setItem((current)=>({...current,hasOverride:true}));
      setMessage("Product saved.");
    }catch(error){setMessage(error instanceof Error?error.message:"Save failed");}
    finally{setSaving(false);}
  }

  async function removeOrReset(){
    const label=item.isCustom?"Delete this product permanently?":"Reset text, pricing and availability overrides to the imported/default product? Local gallery media is retained.";
    if(!confirm(label)) return;
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/admin/products/"+encodeURIComponent(item.id),{method:"DELETE"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Action failed");
      router.push("/admin/menu");
      router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Action failed");setSaving(false);}
  }

  return <div className="admin-product-detail-layout">
    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Product details</h2><p>Customer-facing catalogue information.</p></div><button className={item.enabled?"admin-switch on":"admin-switch"} onClick={()=>patch({enabled:!item.enabled})} title={item.enabled?"Enabled":"Disabled"}></button></div>
      <div className="admin-form">
        <label>Product name<input value={item.name} onChange={(e)=>patch({name:e.target.value})}/></label>
        <label>Card description<textarea rows={3} value={item.description} onChange={(e)=>patch({description:e.target.value})}/><span className="admin-help">Short summary shown on menu cards.</span></label>
        <label>Full product description<textarea rows={8} value={item.longDescription} onChange={(e)=>patch({longDescription:e.target.value})}/><span className="admin-help">Shown on the customer product-detail page.</span></label>
        <label>Ingredients / preparation notes<textarea rows={5} value={item.ingredients} onChange={(e)=>patch({ingredients:e.target.value})}/></label>
      </div>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Commerce & availability</h2><p>Pricing and six-week menu placement.</p></div></div>
      <div className="admin-form">
        <div className="admin-form-grid">
          <label>Price (£)<input type="number" step=".01" min="0" value={item.price} onChange={(e)=>patch({price:Number(e.target.value)})}/></label>
          <label>Menu week<select value={item.week??""} onChange={(e)=>patch({week:e.target.value?Number(e.target.value):null})}><option value="">Always available</option>{[1,2,3,4,5,6].map((value)=><option value={value} key={value}>Week {value}</option>)}</select></label>
          <label>Category<select value={item.category} onChange={(e)=>patch({category:e.target.value})}>{["main","breakfast","soup","treat","special","gift"].map((value)=><option key={value} value={value}>{value}</option>)}</select></label>
          <label>Legacy/fallback image URL<input value={item.image} onChange={(e)=>patch({image:e.target.value})}/><span className="admin-help">Only used when no local gallery image exists.</span></label>
        </div>
        <div className="admin-card-row"><div><strong>Source</strong><small>{item.isCustom?"Created in Simple Kitchen admin":item.canReset?"Built-in / Woo source product #"+item.id:"Imported Woo product #"+item.id}</small></div><span className={item.enabled?"admin-badge active":"admin-badge cancelled"}>{item.enabled?"Active":"Disabled"}</span></div>
      </div>
    </section>

    <section className="admin-panel" style={{gridColumn:"1/-1"}}>
      <AdminProductMedia productId={item.id} initial={item.media} isWoo={!item.isCustom&&/^\d+$/.test(item.id)} onChange={(media)=>patch({media})}/>
    </section>

    <section className="admin-panel" style={{gridColumn:"1/-1"}}>
      {message&&<div className={message.includes("saved")?"admin-alert success":"admin-alert danger"}>{message}</div>}
      <div className="admin-toolbar">
        <button className="admin-primary" disabled={saving} onClick={save}>{saving?"Saving…":"Save product"}</button>
        <a className="admin-secondary" href={"/product/"+encodeURIComponent(item.id)} target="_blank" rel="noreferrer">Preview product ↗</a>
        {(item.isCustom||item.canReset)&&<button className={item.isCustom?"admin-danger":"admin-secondary"} disabled={saving} onClick={removeOrReset}>{item.isCustom?"Delete product":"Reset override"}</button>}
      </div>
    </section>
  </div>;
}
