import { products } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getAllProductMedia } from "@/lib/productMedia";
import { AdminMenuClient } from "@/components/admin/AdminMenuClient";

export const dynamic="force-dynamic";

const SUBSCRIPTION_PRODUCT_IDS=new Set(["291","764","801","4744"]);

export default async function AdminMenuPage(){
  const [result,mediaMap]=await Promise.all([
    db().query("SELECT product_id,enabled,name,description,price_pence,category,week,image FROM product_overrides").catch(()=>({rows:[]})),
    getAllProductMedia().catch(()=>new Map())
  ]);
  const rows=result.rows.filter((row:any)=>!SUBSCRIPTION_PRODUCT_IDS.has(String(row.product_id)));
  const overrides=new Map(rows.map((row:any)=>[String(row.product_id),row]));
  const staticIds=new Set(products.map((product)=>product.id));
  const primaryFor=(id:string)=>{
    const media=(mediaMap.get(id)||[]) as any[];
    return media.find((item)=>item.isPrimary)?.urlPath||media[0]?.urlPath||"";
  };
  const base=products.filter((product)=>!SUBSCRIPTION_PRODUCT_IDS.has(product.id)).map((product)=>{
    const override:any=overrides.get(product.id);
    return {
      id:product.id,name:override?.name||product.name,description:override?.description||product.description,
      price:override?.price_pence!=null?Number(override.price_pence)/100:product.price,
      category:override?.category||product.category,
      week:override?.week!=null?Number(override.week):(product.weeks==="always"?null:Number(product.weeks[0]||1)),
      image:primaryFor(product.id)||override?.image||product.image||"",
      enabled:override?.enabled===false?false:true,isCustom:false,sourceLabel:"Woo/source #"+product.id
    };
  });
  const custom=rows.filter((row:any)=>!staticIds.has(String(row.product_id))).map((row:any)=>({
    id:String(row.product_id),name:row.name||"Draft product",description:row.description||"",
    price:Number(row.price_pence||0)/100,category:row.category||"main",week:row.week!=null?Number(row.week):1,
    image:primaryFor(String(row.product_id))||row.image||"",enabled:row.enabled!==false,isCustom:true,
    sourceLabel:String(row.product_id).startsWith("custom-")?"Admin product":"Imported Woo #"+row.product_id
  }));
  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Catalogue</div><h1>Menu & products</h1><p>Browse the catalogue, then open a product to manage its content, pricing and gallery.</p></div></header>
    <AdminMenuClient initial={[...custom,...base]}/>
  </div>;
}
