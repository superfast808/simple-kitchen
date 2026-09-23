import fs from "node:fs/promises";
import path from "node:path";

const base = (process.env.WOO_SOURCE_URL || "https://simplekitchenprep.com").replace(/\/$/,"");
const key = process.env.WOO_CONSUMER_KEY;
const secret = process.env.WOO_CONSUMER_SECRET;

async function fetchJson(url) {
  const response = await fetch(url, { headers:{ "user-agent":"Simple-Kitchen-Migration/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function importProducts() {
  const all=[];
  if (key && secret) {
    for (let page=1;;page++) {
      const url=new URL(`${base}/wp-json/wc/v3/products`);
      url.searchParams.set("consumer_key",key); url.searchParams.set("consumer_secret",secret);
      url.searchParams.set("per_page","100"); url.searchParams.set("page",String(page));
      const batch=await fetchJson(url); all.push(...batch); if(batch.length<100) break;
    }
  } else {
    for (let page=1;;page++) {
      const url=`${base}/wp-json/wc/store/v1/products?per_page=100&page=${page}`;
      const batch=await fetchJson(url); all.push(...batch); if(batch.length<100) break;
    }
  }
  await fs.mkdir(path.resolve("data"),{recursive:true});
  await fs.writeFile(path.resolve("data/woo-products.json"),JSON.stringify({source:base,importedAt:new Date().toISOString(),count:all.length,products:all},null,2));
  console.log(`Imported ${all.length} WooCommerce products to data/woo-products.json`);
}
await importProducts();
