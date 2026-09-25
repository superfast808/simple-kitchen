"use client";
import { useMemo,useState } from "react";
import { AdminProductMedia } from "./AdminProductMedia";

type Media={id:string;urlPath:string;altText:string;sortOrder:number;isPrimary:boolean;source:string};
type Item={
  id:string;name:string;description:string;longDescription:string;ingredients:string;price:number;category:string;week:number|null;image?:string;
  media:Media[];enabled:boolean;hasOverride:boolean;isCustom:boolean;
};

export function AdminMenuClient({initial}:{initial:Item[]}){
  const [items,setItems]=useState(initial);
  const [week,setWeek]=useState("all");
  const [query,setQuery]=useState("");
  const [saving,setSaving]=useState<string|null>(null);
  const [message,setMessage]=useState("");

  const visible=useMemo(()=>items.filter((item)=>{
    const matchWeek=week==="all"||String(item.week)===week||(week==="always"&&item.week===null);
    return matchWeek&&(!query||item.name.toLowerCase().includes(query.toLowerCase()));
  }),[items,week,query]);

  function patchLocal(id:string,patch:Partial<Item>){
    setItems((current)=>current.map((item)=>item.id===id?{...item,...patch}:item));
  }

  async function createProduct(){
    setSaving("new");setMessage("");
    try{
      const response=await fetch("/api/admin/products",{method:"POST"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to create product");
      setItems((current)=>[{...data.product,longDescription:"",ingredients:"",media:[]},...current]);
      setWeek("all");setQuery("");
      setMessage("New product created — fill in the details and save.");
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to create product");}
    finally{setSaving(null);}
  }

  async function save(item:Item){
    setSaving(item.id);setMessage("");
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
      patchLocal(item.id,{hasOverride:true});
      setMessage(item.name+" saved.");
    }catch(error){setMessage(error instanceof Error?error.message:"Save failed");}
    finally{setSaving(null);}
  }

  async function removeOrReset(item:Item){
    const wording=item.isCustom?"Delete this custom product?":"Reset this product text/pricing override? Local gallery images are retained.";
    if(!confirm(wording)) return;
    setSaving(item.id);setMessage("");
    try{
      const response=await fetch("/api/admin/products/"+encodeURIComponent(item.id),{method:"DELETE"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Action failed");
      if(item.isCustom) setItems((current)=>current.filter((row)=>row.id!==item.id));
      else window.location.reload();
    }catch(error){setMessage(error instanceof Error?error.message:"Action failed");}
    finally{setSaving(null);}
  }

  return <div>
    <div className="admin-toolbar" style={{marginBottom:15}}>
      <button className="admin-primary" disabled={saving==="new"} onClick={createProduct}>{saving==="new"?"Creating…":"+ New product"}</button>
      <input className="admin-input" style={{maxWidth:300}} placeholder="Search products…" value={query} onChange={(e)=>setQuery(e.target.value)}/>
      <select className="admin-input" style={{maxWidth:180}} value={week} onChange={(e)=>setWeek(e.target.value)}>
        <option value="all">All menu weeks</option>
        {[1,2,3,4,5,6].map((value)=><option key={value} value={value}>Week {value}</option>)}
        <option value="always">Always available</option>
      </select>
      <span className="admin-muted">{visible.length} products</span>
    </div>
    {message&&<div className={message.includes("saved")||message.includes("created")?"admin-alert success":"admin-alert danger"}>{message}</div>}
    <div className="admin-product-admin-grid">
      {visible.map((item)=><article className="admin-product-editor" key={item.id}>
        <div className="admin-product-editor-head">
          <img src={item.media[0]?.urlPath||item.image||""} alt=""/>
          <div><strong>{item.name}</strong><small>{item.isCustom?"Admin product":"Woo/source ID "+item.id}</small></div>
          <button type="button" className={item.enabled?"admin-switch on":"admin-switch"} onClick={()=>patchLocal(item.id,{enabled:!item.enabled})} title={item.enabled?"Disable":"Enable"}></button>
        </div>
        <div className="admin-form">
          <label>Name<input value={item.name} onChange={(e)=>patchLocal(item.id,{name:e.target.value})}/></label>
          <label>Card description<textarea rows={2} value={item.description} onChange={(e)=>patchLocal(item.id,{description:e.target.value})}/><span className="admin-help">Short description shown in the menu grid.</span></label>
          <label>Full product description<textarea rows={6} value={item.longDescription} onChange={(e)=>patchLocal(item.id,{longDescription:e.target.value})}/><span className="admin-help">Shown on the customer product-detail page. Woo description is imported here when blank.</span></label>
          <label>Ingredients / preparation notes<textarea rows={4} value={item.ingredients} onChange={(e)=>patchLocal(item.id,{ingredients:e.target.value})}/></label>
          <div className="admin-form-grid">
            <label>Price (£)<input type="number" step=".01" min="0" value={item.price} onChange={(e)=>patchLocal(item.id,{price:Number(e.target.value)})}/></label>
            <label>Menu week<select value={item.week??""} onChange={(e)=>patchLocal(item.id,{week:e.target.value?Number(e.target.value):null})}><option value="">Always</option>{[1,2,3,4,5,6].map((value)=><option value={value} key={value}>Week {value}</option>)}</select></label>
            <label>Category<select value={item.category} onChange={(e)=>patchLocal(item.id,{category:e.target.value})}>{["main","breakfast","soup","treat","special","gift"].map((value)=><option key={value} value={value}>{value}</option>)}</select></label>
            <label>Legacy/fallback image URL<input value={item.image||""} onChange={(e)=>patchLocal(item.id,{image:e.target.value})}/><span className="admin-help">Only used until a local gallery image exists.</span></label>
          </div>
          <AdminProductMedia productId={item.id} initial={item.media} isWoo={!item.isCustom&&/^\d+$/.test(item.id)}/>
          <div className="admin-toolbar">
            <button className="admin-primary" disabled={saving===item.id} onClick={()=>save(item)}>{saving===item.id?"Saving…":"Save product"}</button>
            {(item.hasOverride||item.isCustom)&&<button className={item.isCustom?"admin-danger":"admin-secondary"} disabled={saving===item.id} onClick={()=>removeOrReset(item)}>{item.isCustom?"Delete product":"Reset override"}</button>}
          </div>
        </div>
      </article>)}
    </div>
  </div>;
}
