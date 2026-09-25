"use client";
import { useMemo,useState } from "react";

type Item={
  id:string;name:string;description:string;price:number;category:string;week:number|null;image?:string;
  enabled:boolean;hasOverride:boolean;
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

  async function save(item:Item){
    setSaving(item.id);setMessage("");
    try{
      const response=await fetch("/api/admin/products/"+encodeURIComponent(item.id),{
        method:"PATCH",headers:{"content-type":"application/json"},
        body:JSON.stringify({
          enabled:item.enabled,name:item.name,description:item.description,
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

  async function reset(id:string){
    if(!confirm("Reset this product to the imported/default values?")) return;
    setSaving(id);setMessage("");
    try{
      const response=await fetch("/api/admin/products/"+encodeURIComponent(id),{method:"DELETE"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Reset failed");
      window.location.reload();
    }catch(error){setMessage(error instanceof Error?error.message:"Reset failed");setSaving(null);}
  }

  return <div>
    <div className="admin-toolbar" style={{marginBottom:15}}>
      <input className="admin-input" style={{maxWidth:300}} placeholder="Search products…" value={query} onChange={(e)=>setQuery(e.target.value)}/>
      <select className="admin-input" style={{maxWidth:180}} value={week} onChange={(e)=>setWeek(e.target.value)}>
        <option value="all">All menu weeks</option>
        {[1,2,3,4,5,6].map((value)=><option key={value} value={value}>Week {value}</option>)}
        <option value="always">Always available</option>
      </select>
      <span className="admin-muted">{visible.length} products</span>
    </div>
    {message&&<div className={message.includes("saved")?"admin-alert success":"admin-alert danger"}>{message}</div>}
    <div className="admin-product-admin-grid">
      {visible.map((item)=><article className="admin-product-editor" key={item.id}>
        <div className="admin-product-editor-head">
          <img src={item.image||""} alt=""/>
          <div><strong>{item.name}</strong><small>Woo/source ID {item.id}</small></div>
          <button type="button" className={item.enabled?"admin-switch on":"admin-switch"} onClick={()=>patchLocal(item.id,{enabled:!item.enabled})} title={item.enabled?"Disable":"Enable"}></button>
        </div>
        <div className="admin-form">
          <label>Name<input value={item.name} onChange={(e)=>patchLocal(item.id,{name:e.target.value})}/></label>
          <label>Description<textarea rows={3} value={item.description} onChange={(e)=>patchLocal(item.id,{description:e.target.value})}/></label>
          <div className="admin-form-grid">
            <label>Price (£)<input type="number" step=".01" min="0" value={item.price} onChange={(e)=>patchLocal(item.id,{price:Number(e.target.value)})}/></label>
            <label>Menu week<select value={item.week??""} onChange={(e)=>patchLocal(item.id,{week:e.target.value?Number(e.target.value):null})}><option value="">Always</option>{[1,2,3,4,5,6].map((value)=><option value={value} key={value}>Week {value}</option>)}</select></label>
            <label>Category<select value={item.category} onChange={(e)=>patchLocal(item.id,{category:e.target.value})}>{["main","breakfast","soup","treat","special","gift"].map((value)=><option key={value} value={value}>{value}</option>)}</select></label>
            <label>Image URL<input value={item.image||""} onChange={(e)=>patchLocal(item.id,{image:e.target.value})}/></label>
          </div>
          <div className="admin-toolbar">
            <button className="admin-primary" disabled={saving===item.id} onClick={()=>save(item)}>{saving===item.id?"Saving…":"Save product"}</button>
            {item.hasOverride&&<button className="admin-secondary" disabled={saving===item.id} onClick={()=>reset(item.id)}>Reset override</button>}
          </div>
        </div>
      </article>)}
    </div>
  </div>;
}
