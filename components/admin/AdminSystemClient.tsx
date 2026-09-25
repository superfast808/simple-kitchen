"use client";
import { useState } from "react";

type User={id:string;email:string;display_name:string;role:string;enabled:boolean;last_login_at:string|null;created_at:string};
type Audit={id:number;actor_email:string|null;action:string;entity_type:string|null;entity_id:string|null;detail:unknown;created_at:string};
type Initial={users:User[];audit:Audit[];activeSessions:number;failedLogins:number;checks:{label:string;ok:boolean;note:string}[]};

export function AdminSystemClient({initial,currentUserId}:{initial:Initial;currentUserId:string}){
  const [users,setUsers]=useState(initial.users);
  const [email,setEmail]=useState("");
  const [name,setName]=useState("");
  const [role,setRole]=useState("operator");
  const [password,setPassword]=useState("");
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  async function createUser(){
    setBusy("user");setMessage("");
    try{
      const response=await fetch("/api/admin/users",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,name,role,password})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to create user");
      setUsers((current)=>[data.user,...current]);setEmail("");setName("");setPassword("");
      setMessage("Admin user created.");
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to create user");}
    finally{setBusy("");}
  }

  async function updateUser(user:User,patch:{enabled?:boolean;role?:string}){
    setBusy(user.id);setMessage("");
    try{
      const response=await fetch("/api/admin/users/"+user.id,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(patch)});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to update user");
      setUsers((current)=>current.map((item)=>item.id===user.id?{...item,...patch}:item));
      setMessage("Admin access updated.");
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to update user");}
    finally{setBusy("");}
  }

  async function changePassword(){
    setBusy("password");setMessage("");
    try{
      const response=await fetch("/api/admin/security/password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({currentPassword,newPassword})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to change password");
      window.location.href="/admin/login";
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to change password");setBusy("");}
  }

  return <div className="admin-section-grid">
    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>System health</h2><p>Configuration checks without exposing secret values.</p></div></div>
      <div className="admin-card-list">{initial.checks.map((check)=><div className="admin-card-row" key={check.label}><div><strong>{check.label}</strong><small>{check.note}</small></div><span className={check.ok?"admin-secret-state configured":"admin-secret-state"}>{check.ok?"OK":"Attention"}</span></div>)}</div>
      <div className="admin-form-grid" style={{marginTop:16}}><div className="admin-stat"><small>Active admin sessions</small><strong>{initial.activeSessions}</strong></div><div className="admin-stat"><small>Failed logins · 24h</small><strong>{initial.failedLogins}</strong></div></div>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>Change my password</h2><p>Changing it revokes all of your admin sessions.</p></div></div>
      <div className="admin-form"><label>Current password<input type="password" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)}/></label><label>New password<input type="password" minLength={12} value={newPassword} onChange={(e)=>setNewPassword(e.target.value)}/><span className="admin-help">Minimum 12 characters.</span></label><button className="admin-primary" disabled={busy==="password"||!currentPassword||newPassword.length<12} onClick={changePassword}>Change password & sign out</button></div>
    </section>

    <section className="admin-panel" style={{gridColumn:"1/-1"}}>
      <div className="admin-panel-head"><div><h2>Admin users</h2><p>Create operators/admins and control access.</p></div></div>
      <div className="admin-form-grid three" style={{marginBottom:16}}>
        <label>Name<input className="admin-input" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Operations Manager"/></label>
        <label>Email<input className="admin-input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="name@example.com"/></label>
        <label>Role<select className="admin-input" value={role} onChange={(e)=>setRole(e.target.value)}><option value="viewer">Viewer</option><option value="operator">Operator</option><option value="admin">Admin</option><option value="owner">Owner</option></select></label>
        <label className="wide">Temporary password<input className="admin-input" type="password" minLength={12} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="At least 12 characters"/></label>
      </div>
      <button className="admin-primary" disabled={busy==="user"||!email||password.length<12} onClick={createUser}>Create admin user</button>
      <div className="admin-table-wrap" style={{marginTop:18}}><table className="admin-table"><thead><tr><th>User</th><th>Role</th><th>Last login</th><th>Access</th></tr></thead><tbody>
        {users.map((user)=><tr key={user.id}><td><strong>{user.display_name}</strong><small>{user.email}{user.id===currentUserId?" · you":""}</small></td><td><select className="admin-input" value={user.role} disabled={busy===user.id||user.id===currentUserId} onChange={(e)=>updateUser(user,{role:e.target.value})}>{["viewer","operator","admin","owner"].map((value)=><option key={value}>{value}</option>)}</select></td><td>{user.last_login_at?new Date(user.last_login_at).toLocaleString("en-GB"):"Never"}</td><td><button className={user.enabled?"admin-switch on":"admin-switch"} disabled={busy===user.id||user.id===currentUserId} onClick={()=>updateUser(user,{enabled:!user.enabled})}></button></td></tr>)}
      </tbody></table></div>
    </section>

    <section className="admin-panel" style={{gridColumn:"1/-1"}}>
      <div className="admin-panel-head"><div><h2>Audit trail</h2><p>Latest privileged changes and admin activity.</p></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead><tbody>
        {initial.audit.map((entry)=><tr key={entry.id}><td>{new Date(entry.created_at).toLocaleString("en-GB")}</td><td>{entry.actor_email||"System"}</td><td><strong>{entry.action}</strong></td><td>{entry.entity_type||"—"}{entry.entity_id?<small>{entry.entity_id.slice(0,18)}</small>:null}</td><td><small>{entry.detail?JSON.stringify(entry.detail).slice(0,180):"—"}</small></td></tr>)}
        {!initial.audit.length&&<tr><td colSpan={5}><div className="admin-empty">No audit events yet.</div></td></tr>}
      </tbody></table></div>
    </section>

    {message&&<section className="admin-panel" style={{gridColumn:"1/-1"}}><div className={message.includes("created")||message.includes("updated")?"admin-alert success":"admin-alert danger"}>{message}</div></section>}
  </div>;
}
