import type { MetadataRoute } from "next";
import { getRuntimeProducts } from "@/lib/runtimeCatalog";

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const base=(process.env.NEXT_PUBLIC_SITE_URL||"https://simplekitchenprep.com").replace(/\/$/,"");
  const core=["","/order","/subscriptions","/story","/find-us","/privacy"].map((path)=>({
    url:`${base}${path}`,
    lastModified:new Date(),
    changeFrequency:(path==="/order"?"weekly":"monthly") as "weekly"|"monthly",
    priority:path===""?1:path==="/order"?0.95:0.7
  }));
  const products=(await getRuntimeProducts()).map((product)=>({
    url:`${base}/product/${encodeURIComponent(product.id)}`,
    lastModified:new Date(),
    changeFrequency:"weekly" as const,
    priority:0.8
  }));
  return [...core,...products];
}
