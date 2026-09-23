"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "./CartProvider";
export function ClearCartOnSuccess() {
  const { clear } = useCart();
  useEffect(() => { clear(); }, [clear]);
  return <div className="success-card"><span>✓</span><h1>Thank you</h1><p>Your Simple Kitchen order has been received. We’ll take it from here.</p><Link className="btn" href="/">Back to Simple Kitchen</Link></div>;
}
