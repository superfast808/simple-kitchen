"use client";
import { FormEvent,useState } from "react";

export function CustomerAuthForms(){
  const [tab,setTab]=useState<"login"|"register">("login");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setLoading(true);setError("");
    const form=new FormData(event.currentTarget);
    const payload=Object.fromEntries(form.entries());
    try{
      const response=await fetch("/api/customer/"+tab,{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to continue");
      window.location.href="/account";
    }catch(error){
      setError(error instanceof Error?error.message:"Unable to continue");
      setLoading(false);
    }
  }

  return <div className="account-auth">
    <div className="account-auth-tabs">
      <button className={tab==="login"?"active":""} onClick={()=>{setTab("login");setError("");}}>Sign in</button>
      <button className={tab==="register"?"active":""} onClick={()=>{setTab("register");setError("");}}>Create account</button>
    </div>
    <form className="account-auth-form" onSubmit={submit}>
      {tab==="register"&&<div className="field-grid">
        <label>First name<input name="firstName" autoComplete="given-name" required/></label>
        <label>Last name<input name="lastName" autoComplete="family-name"/></label>
        <label>Phone<input name="phone" type="tel" autoComplete="tel"/></label>
      </div>}
      <label>Email address<input name="email" type="email" autoComplete="email" required/></label>
      <label>Password<input name="password" type="password" minLength={12} autoComplete={tab==="login"?"current-password":"new-password"} required/><span className="admin-help">{tab==="register"?"Use at least 12 characters.":""}</span></label>
      {error&&<div className="error-box">{error}</div>}
      <button className="btn full" disabled={loading}>{loading?(tab==="login"?"Signing in…":"Creating account…"):(tab==="login"?"Sign in":"Create account")}</button>
    </form>
  </div>;
}
