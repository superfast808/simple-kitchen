import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://simplekitchenprep.com";
  return { rules:{ userAgent:"*", allow:"/", disallow:["/checkout","/basket","/account","/subscription-select"] }, sitemap:`${base}/sitemap.xml` };
}
