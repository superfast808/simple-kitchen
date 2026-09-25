import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";

const {Pool}=pg;
const base=(process.env.WOO_SOURCE_URL||"https://simplekitchenprep.com").replace(/\/$/,"");
const key=process.env.WOO_CONSUMER_KEY;
const secret=process.env.WOO_CONSUMER_SECRET;
if(!key||!secret) throw new Error("Woo credentials are missing from .env");

const auth=Buffer.from(`${key}:${secret}`).toString("base64");
const headers={authorization:`Basic ${auth}`,"user-agent":"Simple-Kitchen-Migration/3.0",accept:"application/json"};
const allowedMediaHost=new URL(base).hostname.toLowerCase();
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,max:2}):null;

function api(endpoint,params={}){
  const url=new URL(`${base}/wp-json/wc/v3/${endpoint.replace(/^\//,"")}`);
  for(const [name,value] of Object.entries(params)) url.searchParams.set(name,String(value));
  return url;
}

async function get(url,optional=false){
  const response=await fetch(url,{headers});
  if(optional&&[401,403,404].includes(response.status)) return null;
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

function stripHtml(value=""){
  return String(value)
    .replace(/<br\s*\/?\s*>/gi,"\n")
    .replace(/<\/p>/gi,"\n\n")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#039;/gi,"'")
    .replace(/\s+\n/g,"\n")
    .replace(/\n\s+/g,"\n")
    .replace(/[ \t]{2,}/g," ")
    .trim();
}

function extensionFrom(contentType,url){
  const byType={"image/jpeg":".jpg","image/png":".png","image/webp":".webp","image/gif":".gif","image/avif":".avif"};
  if(byType[contentType]) return byType[contentType];
  const ext=path.extname(new URL(url).pathname).toLowerCase();
  return [".jpg",".jpeg",".png",".webp",".gif",".avif"].includes(ext)?(ext===".jpeg"?".jpg":ext):".jpg";
}


const WEEK_CATEGORY_IDS={18:1,19:2,28:3,29:4,30:5,31:6};

function importedWeek(product){
  for(const category of product.categories||[]){
    const week=WEEK_CATEGORY_IDS[Number(category.id)];
    if(week) return week;
  }
  return null;
}

function importedCategory(product){
  const ids=new Set((product.categories||[]).map(category=>Number(category.id)));
  const name=String(product.name||"").toLowerCase();
  if(ids.has(27)) return "gift";
  if(ids.has(38)||name.includes("special")) return "special";
  if(name.includes("soup")) return "soup";
  if(name.includes("oat")||name.includes("breakfast")) return "breakfast";
  if(name.includes("cake")||name.includes("loaf")||name.includes("brownie")||name.includes("cookie")) return "treat";
  return "main";
}

function catalogueEligible(product){
  const ids=new Set((product.categories||[]).map(category=>Number(category.id)));
  if(ids.has(24)||ids.has(34)) return false;
  return importedWeek(product)!==null||ids.has(27);
}

async function importProductRecord(product){
  if(!pool||!catalogueEligible(product)) return false;
  const price=Number(product.price||product.regular_price);
  if(!Number.isFinite(price)||price<0) return false;
  const week=importedWeek(product);
  const category=importedCategory(product);
  const shortDescription=stripHtml(product.short_description||product.description||"");
  const longDescription=stripHtml(product.description||product.short_description||"");
  await pool.query(
    `INSERT INTO product_overrides
      (product_id,enabled,name,description,long_description,price_pence,category,week,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
     ON CONFLICT (product_id) DO UPDATE SET
       enabled=COALESCE(product_overrides.enabled,EXCLUDED.enabled),
       name=COALESCE(NULLIF(product_overrides.name,''),EXCLUDED.name),
       description=COALESCE(NULLIF(product_overrides.description,''),EXCLUDED.description),
       long_description=COALESCE(NULLIF(product_overrides.long_description,''),EXCLUDED.long_description),
       price_pence=COALESCE(product_overrides.price_pence,EXCLUDED.price_pence),
       category=COALESCE(NULLIF(product_overrides.category,''),EXCLUDED.category),
       week=COALESCE(product_overrides.week,EXCLUDED.week),
       updated_at=now()`,
    [
      String(product.id),String(product.status||"publish")==="publish",String(product.name||"Product"),
      shortDescription||"Chef-prepared Simple Kitchen product.",longDescription||shortDescription||"",
      Math.round(price*100),category,week
    ]
  );
  return true;
}

async function ensureMediaSchema(){
  if(!pool) return;
  await pool.query(`
    ALTER TABLE product_overrides ADD COLUMN IF NOT EXISTS long_description text;
    ALTER TABLE product_overrides ADD COLUMN IF NOT EXISTS ingredients text;
    CREATE TABLE IF NOT EXISTS product_media (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id text NOT NULL,
      url_path text NOT NULL,
      alt_text text,
      sort_order integer NOT NULL DEFAULT 0,
      is_primary boolean NOT NULL DEFAULT false,
      source text NOT NULL DEFAULT 'admin',
      original_url text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(product_id,url_path)
    )
  `);
}

async function importProductMedia(product){
  const images=Array.isArray(product.images)?product.images.slice(0,12):[];
  if(!images.length) return 0;
  const dir=path.resolve("data","media","products",String(product.id));
  await fs.mkdir(dir,{recursive:true});
  for(const filename of await fs.readdir(dir).catch(()=>[])){
    if(filename.startsWith("woo-")) await fs.unlink(path.join(dir,filename)).catch(()=>undefined);
  }
  if(pool) await pool.query("DELETE FROM product_media WHERE product_id=$1 AND source='woo'",[String(product.id)]);

  let count=0;
  for(let index=0;index<images.length;index++){
    const image=images[index];
    const source=String(image?.src||"");
    if(!source) continue;
    const parsed=new URL(source);
    if(parsed.hostname.toLowerCase()!==allowedMediaHost){
      console.warn(`Skipping external image host for product ${product.id}: ${parsed.hostname}`);
      continue;
    }
    const response=await fetch(parsed,{headers:{"user-agent":"Simple-Kitchen-Media-Migration/1.0"}});
    if(!response.ok){
      console.warn(`Image failed ${response.status}: ${source}`);
      continue;
    }
    const type=(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
    if(!type.startsWith("image/")) continue;
    const buffer=Buffer.from(await response.arrayBuffer());
    if(buffer.length>15*1024*1024){
      console.warn(`Image too large, skipping: ${source}`);
      continue;
    }
    const ext=extensionFrom(type,source);
    const filename=`woo-${image?.id||index+1}-${crypto.createHash("sha1").update(buffer).digest("hex").slice(0,8)}${ext}`;
    await fs.writeFile(path.join(dir,filename),buffer);
    const urlPath=`/media/products/${product.id}/${filename}`;

    if(pool){
      if(index===0) await pool.query("UPDATE product_media SET is_primary=false WHERE product_id=$1",[String(product.id)]);
      await pool.query(
        `INSERT INTO product_media (product_id,url_path,alt_text,sort_order,is_primary,source,original_url)
         VALUES ($1,$2,$3,$4,$5,'woo',$6)
         ON CONFLICT (product_id,url_path) DO UPDATE SET
           alt_text=EXCLUDED.alt_text,sort_order=EXCLUDED.sort_order,is_primary=EXCLUDED.is_primary,
           source='woo',original_url=EXCLUDED.original_url,updated_at=now()`,
        [String(product.id),urlPath,String(image?.alt||product.name||""),index,index===0,source]
      );
    }
    count++;
  }

  if(pool){
    const detail=stripHtml(product.description||product.short_description||"");
    await pool.query(
      `INSERT INTO product_overrides (product_id,long_description,updated_at)
       VALUES ($1,$2,now())
       ON CONFLICT (product_id) DO UPDATE SET
         long_description=CASE
           WHEN product_overrides.long_description IS NULL OR product_overrides.long_description='' THEN EXCLUDED.long_description
           ELSE product_overrides.long_description
         END,
         updated_at=now()`,
      [String(product.id),detail||null]
    );
  }
  return count;
}

async function main(){
  const products=await paged("products",{context:"edit"});
  const categories=await paged("products/categories",{hide_empty:false});
  const tags=await paged("products/tags",{hide_empty:false});
  const coupons=await paged("coupons",{context:"edit"});
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
      id:zone.id,name:zone.name,locations,
      methods:methods.map(method=>({
        id:method.id,instance_id:method.instance_id,title:method.title,method_title:method.method_title,
        enabled:method.enabled,settings:method.settings||{}
      }))
    });
  }

  await ensureMediaSchema();
  let mediaFiles=0;
  let catalogProducts=0;
  for(const product of products){
    if(await importProductRecord(product)) catalogProducts++;
    const count=await importProductMedia(product);
    mediaFiles+=count;
    if(count) console.log(`media ${product.id} ${product.name}: ${count}`);
  }

  const snapshot={source:base,importedAt:new Date().toISOString(),products,categories,tags,variations,coupons,shipping};
  await fs.mkdir(path.resolve("data"),{recursive:true});
  await fs.writeFile(path.resolve("data/woo-products.json"),JSON.stringify(snapshot,null,2));

  const inspection={
    source:base,importedAt:snapshot.importedAt,
    counts:{
      products:products.length,categories:categories.length,tags:tags.length,
      variations:Object.values(variations).reduce((sum,rows)=>sum+rows.length,0),
      shippingZones:shipping.length,coupons:coupons.length,mediaFiles,catalogProducts
    },
    products:products.map(product=>({
      id:product.id,name:product.name,slug:product.slug,status:product.status,type:product.type,sku:product.sku,
      price:product.price,regular_price:product.regular_price,sale_price:product.sale_price,
      categories:(product.categories||[]).map(c=>c.name),tags:(product.tags||[]).map(t=>t.name),
      images:(product.images||[]).map(image=>image.src),description:product.description||"",
      short_description:product.short_description||"",variations:product.variations||[],attributes:product.attributes||[],
      meta:(product.meta_data||[]).map(entry=>({key:entry.key,value:entry.value}))
    })),
    variations,
    categories:categories.map(category=>({id:category.id,name:category.name,slug:category.slug,parent:category.parent,count:category.count})),
    coupons:coupons.map(coupon=>({
      id:coupon.id,code:coupon.code,amount:coupon.amount,status:coupon.status,discount_type:coupon.discount_type,
      description:coupon.description,date_expires:coupon.date_expires,individual_use:coupon.individual_use,
      product_ids:coupon.product_ids||[],excluded_product_ids:coupon.excluded_product_ids||[],
      usage_limit:coupon.usage_limit,usage_limit_per_user:coupon.usage_limit_per_user,
      limit_usage_to_x_items:coupon.limit_usage_to_x_items,free_shipping:coupon.free_shipping,
      product_categories:coupon.product_categories||[],excluded_product_categories:coupon.excluded_product_categories||[],
      exclude_sale_items:coupon.exclude_sale_items,minimum_amount:coupon.minimum_amount,maximum_amount:coupon.maximum_amount,
      email_restrictions:coupon.email_restrictions||[],usage_count:coupon.usage_count
    })),
    shipping
  };

  await fs.writeFile(path.resolve("data/woo-inspection.json"),JSON.stringify(inspection,null,2));
  if(pool) await pool.end();

  console.log("\nWoo import complete");
  console.log(JSON.stringify(inspection.counts,null,2));
  console.log("Raw catalogue: data/woo-products.json");
  console.log("Inspection:    data/woo-inspection.json");
  console.log("Local media:   data/media/products/");
}

await main();
