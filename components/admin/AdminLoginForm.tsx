"use client";
import { FormEvent,useState } from "react";

export function AdminLoginForm(){
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setLoading(true);setError("");
    const form=new FormData(event.currentTarget);
    try{
      const response=await fetch("/api/admin/auth/login",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({email:String(form.get("email")||""),password:String(form.get("password")||"")})
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Sign in failed");
      window.location.href="/admin";
    }catch(error){
      setError(error instanceof Error?error.message:"Sign in failed");
      setLoading(false);
    }
  }
  return <form className="admin-login-card" onSubmit={submit}>
    <div className="admin-login-logo">SK</div>
    <div><div className="admin-kicker">Operations Console</div><h1>Welcome back</h1><p>Sign in to manage Simple Kitchen.</p></div>
    <label>Email address<input name="email" type="email" autoComplete="username" required autoFocus/></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required/></label>
    {error&&<div className="admin-alert danger">{error}</div>}
    <button className="admin-primary" disabled={loading}>{loading?"Signing in…":"Sign in securely"}</button>
    <small className="admin-login-note">Protected by rate limiting, revocable sessions and audit logging.</small>
  </form>;
}
