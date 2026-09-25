"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links=[
  ["/admin","Overview","⌂"],
  ["/admin/orders","Orders","▤"],
  ["/admin/subscriptions","Subscriptions","↻"],
  ["/admin/customers","Customers","◎"],
  ["/admin/menu","Menu & products","◫"],
  ["/admin/content","Content & heroes","▣"],
  ["/admin/weeks","Weeks & schedule","◷"],
  ["/admin/coupons","Coupons & gift cards","%"],
  ["/admin/fulfilment","Delivery & collection","⌖"],
  ["/admin/messaging","Messaging","✉"],
  ["/admin/settings","Settings","⚙"],
  ["/admin/system","System & audit","⌁"]
] as const;

export function AdminNav({name,role}:{name:string;role:string}){
  const pathname=usePathname();
  const [open,setOpen]=useState(false);
  return <aside className={open?"admin-sidebar open":"admin-sidebar"}>
    <div className="admin-brand">
      <div><span>SK</span><div><strong>Simple Kitchen</strong><small>Operations Console</small></div></div>
      <button className="admin-menu-button" onClick={()=>setOpen(!open)} aria-label="Toggle admin menu">☰</button>
    </div>
    <nav className="admin-nav">
      {links.map(([href,label,icon])=>{
        const active=href==="/admin"?pathname===href:pathname.startsWith(href);
        return <Link key={href} href={href} className={active?"active":""} onClick={()=>setOpen(false)}><span>{icon}</span>{label}</Link>;
      })}
    </nav>
    <div className="admin-user">
      <div className="admin-avatar">{name.slice(0,1).toUpperCase()}</div>
      <div><strong>{name}</strong><small>{role}</small></div>
      <form action="/api/admin/auth/logout" method="post"><button title="Sign out">↪</button></form>
    </div>
  </aside>;
}
