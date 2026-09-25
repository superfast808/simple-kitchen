import { products } from "@/lib/catalog";
import { db } from "@/lib/db";
import { AdminMenuClient } from "@/components/admin/AdminMenuClient";

export const dynamic="force-dynamic";

export default async function AdminMenuPage(){
  const result=await db().query("SELECT product_id,enabled,name,description,price_pence,category,week,image FROM product_overrides").catch(()=>({rows:[]}));
  const overrides=new Map(result.rows.map((row:any)=>[String(row.product_id),row]));
  const initial=products.map((product)=>{
    const override:any=overrides.get(product.id);
    const week=override?.week!=null?Number(override.week):(product.weeks==="always"?null:Number(product.weeks[0]||1));
    return {
      id:product.id,
      name:override?.name||product.name,
      description:override?.description||product.description,
      price:override?.price_pence!=null?Number(override.price_pence)/100:product.price,
      category:override?.category||product.category,
      week,
      image:override?.image||product.image||"",
      enabled:override?.enabled===false?false:true,
      hasOverride:Boolean(override)
    };
  });
  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Catalogue</div><h1>Menu & products</h1><p>Change live availability, pricing, menu week, copy and imagery without redeploying.</p></div></header>
    <AdminMenuClient initial={initial}/>
  </div>;
}
