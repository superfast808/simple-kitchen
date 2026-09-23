"use client";
import Link from "next/link";
import { useState } from "react";
import { site } from "@/lib/site";
import { useCart } from "./CartProvider";

export function Header() {
  const [open, setOpen] = useState(false);
  const { count } = useCart();
  return <>
    <div className="announcement">Fresh chef-prepared meals · Weekly menu · Glasgow delivery & collection</div>
    <header className="site-header">
      <Link href="/" className="brand"><img src={site.logo} alt="Simple Kitchen" /></Link>
      <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label="Toggle menu"><span/><span/><span/></button>
      <nav className={open ? "nav nav-open" : "nav"}>
        <Link href="/" onClick={() => setOpen(false)}>Home</Link>
        <Link href="/story" onClick={() => setOpen(false)}>Our Story</Link>
        <Link href="/find-us" onClick={() => setOpen(false)}>Where to find us</Link>
        <Link href="/order" onClick={() => setOpen(false)}>Order Here</Link>
        <Link href="/subscriptions" onClick={() => setOpen(false)}>Subscriptions</Link>
        <Link href="/account" onClick={() => setOpen(false)}>Account</Link>
        <Link href="/basket" className="basket-link" onClick={() => setOpen(false)}>Basket <span>{count}</span></Link>
      </nav>
    </header>
  </>;
}
