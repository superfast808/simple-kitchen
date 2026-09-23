import fs from "node:fs/promises";
import path from "node:path";

const base=(process.env.WOO_SOURCE_URL||"https://simplekitchenprep.com").replace(/\/$/,"");
const key=process.env.WOO_CONSUMER_KEY;
const secret=process.env.WOO_CONSUMER_SECRET;
if(!key||!secret) throw new Error("Woo credentials are missing from .env");

const auth=Buffer.from(`${key}:${secret}`).toString("base64");
const headers={authorization:`Basic ${auth}`,"user-agent":"Simple-Kitchen-Migration/2.0",accept:"application/json"};

function api(endpoint,params={}){
  const url=new URL(`${base}/wp-json/wc/v3/${endpoint.replace(/^\//,"")}`);
  for(const [name,value] of Object.entries(params)) url.searchParams.set(name,String(value));
  return url;
}

async function get(url,optional=false){
  const response=await fetch(url,{headers});
  if(optional && [401,403,404].includes(response.status)) return null;
  if(!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url.pathname}`);
  return response.json();
}

async function paged(endpoint,params={}){
  const rows=[];
  for(let page=1;;page++){
    const batch=await get(api(endpoint,{...params,per_page:100,page}));
    if(!Array.isArray(batch)) throw new Error(`Unexpected response from ${endpoint}`);
    rows.push(...batch);
    console.log(`${endpoint}: ${rows.length}`);
    if(batch.length<100) break;
  }
  return rows;
}

async function main(){
  const products=await paged("products",{context:"edit"});
  const categories=await paged("products/categories",{hide_empty:false});
  const tags=await paged("products/tags",{hide_empty:false});
  const variations={};

  for(const product of products){
    if(Array.isArray(product.variations)&&product.variations.length){
      variations[product.id]=await paged(`products/${product.id}/variations`,{context:"edit"});
    }
  }

  const zones=(await get(api("shipping/zones"),true))||[];
  const shipping=[];
  for(const zone of zones){
    const methods=(await get(api(`shipping/zones/${zone.id}/methods`),true))||[];
    const locations=(await get(api(`shipping/zones/${zone.id}/locations`),true))||[];
    shipping.push({
      id:zone.id,
      name:zone.name,
      locations,
      methods:methods.map(method=>({
        id:method.id,
        instance_id:method.instance_id,
        title:method.title,
        method_title:method.method_title,
        enabled:method.enabled,
        settings:method.settings||{}
      }))
    });
  }

  const snapshot={
    source:base,
    importedAt:new Date().toISOString(),
    products,
    categories,
    tags,
    variations,
    shipping
  };

  await fs.mkdir(path.resolve("data"),{recursive:true});
  await fs.writeFile(path.resolve("data/woo-products.json"),JSON.stringify(snapshot,null,2));

  const inspection={
    source:base,
    importedAt:snapshot.importedAt,
    counts:{
      products:products.length,
      categories:categories.length,
      tags:tags.length,
      variations:Object.values(variations).reduce((sum,rows)=>sum+rows.length,0),
      shippingZones:shipping.length
    },
    products:products.map(product=>({
      id:product.id,
      name:product.name,
      slug:product.slug,
      status:product.status,
      type:product.type,
      sku:product.sku,
      price:product.price,
      regular_price:product.regular_price,
      sale_price:product.sale_price,
      categories:(product.categories||[]).map(c=>c.name),
      tags:(product.tags||[]).map(t=>t.name),
      images:(product.images||[]).map(image=>image.src),
      description:product.description||"",
      short_description:product.short_description||"",
      variations:product.variations||[],
      attributes:product.attributes||[],
      meta:(product.meta_data||[]).map(entry=>({key:entry.key,value:entry.value}))
    })),
    variations,
    categories:categories.map(category=>({
      id:category.id,name:category.name,slug:category.slug,parent:category.parent,count:category.count
    })),
    shipping
  };

  await fs.writeFile(path.resolve("data/woo-inspection.json"),JSON.stringify(inspection,null,2));

  console.log("\nWoo import complete");
  console.log(JSON.stringify(inspection.counts,null,2));
  console.log("Raw catalogue: data/woo-products.json");
  console.log("Inspection:    data/woo-inspection.json");
}

await main();
