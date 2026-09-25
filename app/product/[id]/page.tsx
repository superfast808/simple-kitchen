import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/ProductDetailClient";
import { getRuntimeMenuState } from "@/lib/cycle";
import { getRuntimeProductById } from "@/lib/runtimeCatalog";

export const dynamic="force-dynamic";

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const {id}=await params;
  const product=await getRuntimeProductById(decodeURIComponent(id));
  if(!product) return {title:"Product"};
  return {title:product.name,description:product.description};
}

export default async function ProductPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const product=await getRuntimeProductById(decodeURIComponent(id));
  if(!product) notFound();
  const state=await getRuntimeMenuState();
  const available=product.weeks==="always"||(state.open&&product.weeks.includes(state.week));

  return <>
    <section className="product-breadcrumb shell"><Link href="/order">← Back to this week’s menu</Link></section>
    <section className="section shell"><ProductDetailClient product={product} available={available}/></section>
  </>;
}
