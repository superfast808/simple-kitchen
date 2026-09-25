"use client";
import { useState } from "react";

type Media={id:string;urlPath:string;altText:string;sortOrder:number;isPrimary:boolean;source:string};

export function AdminProductMedia({productId,initial,isWoo,onChange}:{productId:string;initial:Media[];isWoo:boolean;onChange?:(media:Media[])=>void}){
  const [media,setMedia]=useState(initial);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  function applyMedia(next:Media[]){setMedia(next);onChange?.(next);}

  async function upload(files:FileList|null){
    if(!files?.length) return;
    setBusy("upload");setMessage("");
    try{
      const form=new FormData();
      Array.from(files).forEach((file)=>form.append("files",file));
      const response=await fetch("/api/admin/products/"+encodeURIComponent(productId)+"/media",{method:"POST",body:form});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Upload failed");
      applyMedia(data.media);setMessage(files.length+" image"+(files.length===1?"":"s")+" uploaded.");
    }catch(error){setMessage(error instanceof Error?error.message:"Upload failed");}
    finally{setBusy("");}
  }

  async function saveOrder(next:Media[]){
    setBusy("order");setMessage("");
    try{
      const response=await fetch("/api/admin/products/"+encodeURIComponent(productId)+"/media",{
        method:"PATCH",headers:{"content-type":"application/json"},
        body:JSON.stringify({items:next.map((item,index)=>({id:item.id,sortOrder:index,isPrimary:item.isPrimary,altText:item.altText}))})
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to update gallery");
      applyMedia(data.media);setMessage("Gallery updated.");
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to update gallery");}
    finally{setBusy("");}
  }

  function move(index:number,direction:-1|1){
    const target=index+direction;
    if(target<0||target>=media.length) return;
    const next=[...media];
    [next[index],next[target]]=[next[target],next[index]];
    saveOrder(next.map((item,i)=>({...item,sortOrder:i})));
  }

  function primary(id:string){
    saveOrder(media.map((item,index)=>({...item,sortOrder:index,isPrimary:item.id===id})));
  }

  async function remove(id:string){
    if(!confirm("Delete this image from the product gallery?")) return;
    setBusy(id);setMessage("");
    try{
      const response=await fetch("/api/admin/products/"+encodeURIComponent(productId)+"/media?mediaId="+encodeURIComponent(id),{method:"DELETE"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to delete image");
      applyMedia(data.media);setMessage("Image removed.");
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to delete image");}
    finally{setBusy("");}
  }

  async function importWoo(){
    setBusy("woo");setMessage("");
    try{
      const response=await fetch("/api/admin/products/"+encodeURIComponent(productId)+"/import-woo-media",{method:"POST"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Woo import failed");
      applyMedia(data.media);setMessage(data.imported+" Woo image"+(data.imported===1?"":"s")+" imported locally.");
    }catch(error){setMessage(error instanceof Error?error.message:"Woo import failed");}
    finally{setBusy("");}
  }

  return <div className="admin-media-manager">
    <div className="admin-panel-head"><div><h3>Product gallery</h3><p>Stored locally and served by Simple Kitchen.</p></div><div className="admin-toolbar">
      {isWoo&&<button type="button" className="admin-secondary" disabled={Boolean(busy)} onClick={importWoo}>{busy==="woo"?"Importing…":"↻ Import from Woo"}</button>}
      <label className="admin-secondary admin-file-button">{busy==="upload"?"Uploading…":"+ Upload images"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple disabled={Boolean(busy)} onChange={(e)=>{upload(e.target.files);e.currentTarget.value="";}}/></label>
    </div></div>
    <div className="admin-media-grid">
      {media.map((item,index)=><div className={item.isPrimary?"admin-media-item primary":"admin-media-item"} key={item.id}>
        <img src={item.urlPath} alt={item.altText||""}/>
        <div className="admin-media-meta"><strong>{item.isPrimary?"Primary image":"Gallery image"}</strong><small>{item.source}</small></div>
        <div className="admin-media-actions">
          <button type="button" className="admin-secondary" disabled={Boolean(busy)||index===0} onClick={()=>move(index,-1)}>↑</button>
          <button type="button" className="admin-secondary" disabled={Boolean(busy)||index===media.length-1} onClick={()=>move(index,1)}>↓</button>
          {!item.isPrimary&&<button type="button" className="admin-secondary" disabled={Boolean(busy)} onClick={()=>primary(item.id)}>Primary</button>}
          <button type="button" className="admin-danger" disabled={Boolean(busy)} onClick={()=>remove(item.id)}>×</button>
        </div>
      </div>)}
      {!media.length&&<div className="admin-empty">No local images yet. Upload images or import this product’s Woo media.</div>}
    </div>
    {message&&<div className={message.includes("failed")||message.includes("Unable")?"admin-alert danger":"admin-alert success"}>{message}</div>}
  </div>;
}
