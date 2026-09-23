"use client";
import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";

export function SubscriptionSelector({ token, meals, products }: { token:string; meals:number; products:Product[] }) {
  const [selection,setSelection]=useState<Record<string,number>>({});
  const [message,setMessage]=useState(""); const [saving,setSaving]=useState(false);
  const total=useMemo(()=>Object.values(selection).reduce((a,b)=>a+b,0),[selection]);
  async function save(){
    setSaving(true);setMessage("");
    const items=Object.entries(selection).filter(([,q])=>q>0).map(([id,quantity])=>({id,quantity}));
    const r=await fetch("/api/subscription-selection",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,items})});
    const data=await r.json();setSaving(false);setMessage(r.ok?"Your meals are saved for this week.":data.error||"Unable to save.");
  }
  return <div><div className="selection-counter"><span>Choose exactly {meals} meals</span><strong className={total===meals?"good":""}>{total} / {meals}</strong></div><div className="selection-grid">{products.map(product=><article className="selection-card" key={product.id}><img src={product.image} alt=""/><div><h3>{product.name}</h3><p>{product.description}</p><div className="basket-controls"><button onClick={()=>setSelection(s=>({...s,[product.id]:Math.max(0,(s[product.id]||0)-1)}))}>−</button><span>{selection[product.id]||0}</span><button disabled={total>=meals} onClick={()=>setSelection(s=>({...s,[product.id]:(s[product.id]||0)+1}))}>+</button></div></div></article>)}</div>{message&&<div className={message.startsWith("Your")?"success-box":"error-box"}>{message}</div>}<button className="btn selection-save" disabled={saving||total!==meals} onClick={save}>{saving?"Saving…":"Save this week’s meals"}</button></div>;
}
