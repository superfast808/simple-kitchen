import Link from "next/link";
import { notFound } from "next/navigation";
import { productById } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getProductMedia } from "@/lib/productMedia";
import { AdminProductEditor } from "@/components/admin/AdminProductEditor";

export const dynamic="force-dynamic";

const SUBSCRIPTION_PRODUCT_IDS=new Set(["291","764","801","4744"]);

export default async function AdminProductPage({params}:{params:Promise<{id:string}>}){
  const {id:raw}=await params;
  const id=decodeURIComponent(raw);
  if(SUBSCRIPTION_PRODUCT_IDS.has(id)) notFound();

  const [overrideResult,media]=await Promise.all([
    db().query("SELECT product_id,enabled,name,description,long_description,ingredients,price_pence,category,week,image FROM product_overrides WHERE product_id=$1",[id]).catch(()=>({rows:[]})),
    getProductMedia(id).catch(()=>[])
  ]);
  const override:any=overrideResult.rows[0];
  const base=productById.get(id);
  if(!base&&!override) notFound();

  const isCustom=!base;
  const week=override?.week!=null?Number(override.week):(base?.weeks==="always"?null:Number(base?.weeks?.[0]||1));
  const item={
    id,
    name:override?.name||base?.name||"Draft product",
    description:override?.description||base?.description||"",
    longDescription:override?.long_description||base?.longDescription||base?.description||"",
    ingredients:override?.ingredients||base?.ingredients||"",
    price:override?.price_pence!=null?Number(override.price_pence)/100:Number(base?.price||0),
    category:override?.category||base?.category||"main",
    week,
    image:override?.image||base?.image||"",
    enabled:override?.enabled===false?false:true,
    isCustom,
    hasOverride:Boolean(override),
    media:media.map((entry)=>({id:entry.id,urlPath:entry.urlPath,altText:entry.altText,sortOrder:entry.sortOrder,isPrimary:entry.isPrimary,source:entry.source}))
  };

  return <div className="admin-page">
    <header className="admin-page-head">
      <div><div className="admin-kicker"><Link href="/admin/menu">Catalogue</Link> / Product</div><h1>{item.name}</h1><p>Edit the product, its pricing, menu placement and locally owned image gallery.</p></div>
      <Link className="admin-secondary" href="/admin/menu">← Back to products</Link>
    </header>
    <AdminProductEditor initial={item}/>
  </div>;
}
