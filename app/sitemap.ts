import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const base=(process.env.NEXT_PUBLIC_SITE_URL || "https://simplekitchenprep.com").replace(/\/$/,"");
  return ["","/order","/subscriptions","/story","/find-us","/privacy"].map((path)=>({url:`${base}${path}`,lastModified:new Date(),changeFrequency:path==="/order"?"weekly":"monthly",priority:path===""?1:path==="/order"?0.95:0.7}));
}
