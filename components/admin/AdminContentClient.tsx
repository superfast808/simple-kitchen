"use client";
import { useMemo,useState } from "react";

type Hero={
  eyebrow:string;title:string;copy:string;background:string;overlay:number;position:string;
  primaryLabel?:string;primaryHref?:string;secondaryLabel?:string;secondaryHref?:string;
};
type Key="home"|"order"|"subscriptions"|"story"|"find-us"|"checkout"|"account";

const labels:Record<Key,string>={
  home:"Home",order:"Order",subscriptions:"Subscriptions",story:"Our Story","find-us":"Find Us",checkout:"Checkout",account:"Account"
};
const positions=["center center","center top","center bottom","left center","right center","left top","right top","left bottom","right bottom"];

export function AdminContentClient({initial}:{initial:Record<Key,Hero>}){
  const [heroes,setHeroes]=useState(initial);
  const [selected,setSelected]=useState<Key>("home");
  const [saving,setSaving]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [message,setMessage]=useState("");
  const hero=heroes[selected];

  function patch(patch:Partial<Hero>){
    setHeroes((current)=>({...current,[selected]:{...current[selected],...patch}}));
  }

  async function upload(file:File|null){
    if(!file) return;
    setUploading(true);setMessage("");
    try{
      const form=new FormData();
      form.append("page",selected);form.append("file",file);
      const response=await fetch("/api/admin/content/hero-upload",{method:"POST",body:form});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Upload failed");
      patch({background:data.url});
      setMessage("Hero image uploaded. Save content to publish it.");
    }catch(error){setMessage(error instanceof Error?error.message:"Upload failed");}
    finally{setUploading(false);}
  }

  async function save(){
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/admin/content",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({heroes})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to save content");
      setMessage("Hero content saved.");
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to save content");}
    finally{setSaving(false);}
  }

  const previewStyle=useMemo(()=>hero.background?{
    backgroundImage:`linear-gradient(rgba(22,31,18,${hero.overlay}),rgba(22,31,18,${hero.overlay})),url("${hero.background}")`,
    backgroundPosition:hero.position
  }:undefined,[hero]);

  return <div className="admin-content-layout">
    <aside className="admin-panel admin-content-pages">
      <div className="admin-panel-head"><div><h2>Pages</h2><p>Select a hero to edit.</p></div></div>
      <div className="admin-content-page-list">{(Object.keys(labels) as Key[]).map((key)=><button key={key} className={selected===key?"active":""} onClick={()=>{setSelected(key);setMessage("");}}><strong>{labels[key]}</strong><small>{heroes[key].title}</small></button>)}</div>
    </aside>

    <div className="admin-content-main">
      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>{labels[selected]} hero</h2><p>Copy, background and presentation.</p></div><span className="admin-badge">{selected}</span></div>
        <div className="admin-form">
          <div className="admin-form-grid">
            <label>Eyebrow<input value={hero.eyebrow} onChange={(e)=>patch({eyebrow:e.target.value})}/></label>
            <label>Title<input value={hero.title} onChange={(e)=>patch({title:e.target.value})}/></label>
          </div>
          <label>Hero copy<textarea rows={4} value={hero.copy} onChange={(e)=>patch({copy:e.target.value})}/></label>

          <div className="admin-form-grid">
            <label>Image position<select value={hero.position} onChange={(e)=>patch({position:e.target.value})}>{positions.map((position)=><option value={position} key={position}>{position.replace(" "," / ")}</option>)}</select></label>
            <label>Overlay strength <strong>{Math.round(hero.overlay*100)}%</strong><input type="range" min="0" max=".85" step=".05" value={hero.overlay} onChange={(e)=>patch({overlay:Number(e.target.value)})}/></label>
          </div>

          <div className="admin-hero-image-row">
            <div className="admin-hero-thumb">{hero.background?<img src={hero.background} alt=""/>:<span>No background</span>}</div>
            <div>
              <strong>Hero background</strong><small>Stored locally when uploaded here.</small>
              <div className="admin-toolbar">
                <label className="admin-secondary admin-file-button">{uploading?"Uploading…":"Upload background"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={(e)=>{upload(e.target.files?.[0]||null);e.currentTarget.value="";}}/></label>
                {hero.background&&<button className="admin-secondary" onClick={()=>patch({background:""})}>Remove background</button>}
              </div>
            </div>
          </div>

          {selected==="home"&&<>
            <h3>Homepage actions</h3>
            <div className="admin-form-grid">
              <label>Primary button label<input value={hero.primaryLabel||""} onChange={(e)=>patch({primaryLabel:e.target.value})}/></label>
              <label>Primary button link<input value={hero.primaryHref||""} onChange={(e)=>patch({primaryHref:e.target.value})}/></label>
              <label>Secondary button label<input value={hero.secondaryLabel||""} onChange={(e)=>patch({secondaryLabel:e.target.value})}/></label>
              <label>Secondary button link<input value={hero.secondaryHref||""} onChange={(e)=>patch({secondaryHref:e.target.value})}/></label>
            </div>
          </>}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>Preview</h2><p>Approximate desktop presentation.</p></div></div>
        <div className={hero.background?"admin-hero-preview has-image":"admin-hero-preview"} style={previewStyle}>
          <div><div className="eyebrow">{hero.eyebrow}</div><h2>{hero.title}</h2>{hero.copy&&<p>{hero.copy}</p>}{selected==="home"&&<div className="hero-actions">{hero.primaryLabel&&<span className="btn">{hero.primaryLabel}</span>}{hero.secondaryLabel&&<span className="btn btn-ghost">{hero.secondaryLabel}</span>}</div>}</div>
        </div>
      </section>

      {message&&<div className={message.includes("saved")||message.includes("uploaded")?"admin-alert success":"admin-alert danger"}>{message}</div>}
      <div className="admin-toolbar"><button className="admin-primary" disabled={saving} onClick={save}>{saving?"Saving…":"Save hero content"}</button><span className="admin-muted">Changes apply immediately to the public site.</span></div>
    </div>
  </div>;
}
