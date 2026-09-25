import { db } from "./db";
import { products,productById } from "./catalog";
import { getAllProductMedia,getProductMedia } from "./productMedia";
import type { Product,ProductCategory } from "./types";

let schemaReady:Promise<void>|null=null;
async function ensureSchema(){
  if(!schemaReady){
    schemaReady=db().query(`
      CREATE TABLE IF NOT EXISTS product_overrides (
        product_id text PRIMARY KEY,
        enabled boolean,
        name text,
        description text,
        long_description text,
        ingredients text,
        price_pence integer,
        category text,
        week integer,
        image text,
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE product_overrides ADD COLUMN IF NOT EXISTS long_description text;
      ALTER TABLE product_overrides ADD COLUMN IF NOT EXISTS ingredients text;
    `).then(()=>undefined);
  }
  await schemaReady;
}

type Override={
  product_id:string;enabled:boolean|null;name:string|null;description:string|null;long_description:string|null;ingredients:string|null;
  price_pence:number|null;category:string|null;week:number|null;image:string|null;
};

function apply(product:Product,override?:Override,images:string[]=[]):Product|null{
  if(override?.enabled===false) return null;
  const fallback=override?.image||product.image;
  const gallery=images.length?images:(fallback?[fallback]:product.images||[]);
  return {
    ...product,
    name:override?.name||product.name,
    description:override?.description||product.description,
    longDescription:override?.long_description||product.longDescription||product.description,
    ingredients:override?.ingredients||product.ingredients,
    price:override?.price_pence!=null?Number(override.price_pence)/100:product.price,
    category:(override?.category||product.category) as ProductCategory,
    weeks:override?.week!=null?[Number(override.week)]:product.weeks,
    image:gallery[0]||fallback,
    images:gallery
  };
}

function customProduct(row:Override,images:string[]=[]):Product|null{
  if(row.enabled===false||!row.name||row.price_pence==null||!row.category) return null;
  const gallery=images.length?images:(row.image?[row.image]:[]);
  return {
    id:row.product_id,
    name:row.name,
    description:row.description||"Chef-prepared Simple Kitchen meal.",
    longDescription:row.long_description||row.description||"Chef-prepared Simple Kitchen meal.",
    ingredients:row.ingredients||undefined,
    price:Number(row.price_pence)/100,
    category:row.category as ProductCategory,
    weeks:row.week==null?"always":[Number(row.week)],
    image:gallery[0]||row.image||undefined,
    images:gallery
  };
}

export async function getRuntimeProducts(){
  try{
    await ensureSchema();
    const [result,media]=await Promise.all([
      db().query("SELECT product_id,enabled,name,description,long_description,ingredients,price_pence,category,week,image FROM product_overrides"),
      getAllProductMedia()
    ]);
    const overrides=result.rows as Override[];
    const map=new Map(overrides.map((row)=>[String(row.product_id),row]));
    const staticIds=new Set(products.map((product)=>product.id));
    const base=products.map((product)=>apply(product,map.get(product.id),(media.get(product.id)||[]).map((item)=>item.urlPath))).filter(Boolean) as Product[];
    const custom=overrides.filter((row)=>!staticIds.has(row.product_id)).map((row)=>customProduct(row,(media.get(row.product_id)||[]).map((item)=>item.urlPath))).filter(Boolean) as Product[];
    return [...base,...custom];
  }catch{
    return products;
  }
}

export async function getRuntimeProductsForWeek(week:number,menuOpen:boolean){
  const all=await getRuntimeProducts();
  return all.filter((product)=>product.weeks==="always"||(menuOpen&&product.weeks.includes(week)));
}

export async function getRuntimeProductById(id:string){
  const base=productById.get(id);
  try{
    await ensureSchema();
    if(base){
      const overrideId=/^\d+-\d+$/.test(id)?id.split("-")[0]:id;
      const [result,media]=await Promise.all([
        db().query("SELECT product_id,enabled,name,description,long_description,ingredients,price_pence,category,week,image FROM product_overrides WHERE product_id=$1",[overrideId]),
        getProductMedia(overrideId)
      ]);
      return apply(base,result.rows[0] as Override|undefined,media.map((item)=>item.urlPath));
    }
    const [custom,media]=await Promise.all([
      db().query("SELECT product_id,enabled,name,description,long_description,ingredients,price_pence,category,week,image FROM product_overrides WHERE product_id=$1",[id]),
      getProductMedia(id)
    ]);
    return custom.rows[0]?customProduct(custom.rows[0] as Override,media.map((item)=>item.urlPath)):null;
  }catch{
    return base||null;
  }
}

export async function saveProductOverride(input:{
  productId:string;enabled:boolean|null;name?:string|null;description?:string|null;longDescription?:string|null;ingredients?:string|null;
  pricePence?:number|null;category?:string|null;week?:number|null;image?:string|null;userId?:string;
}){
  await ensureSchema();
  await db().query(
    `INSERT INTO product_overrides (product_id,enabled,name,description,long_description,ingredients,price_pence,category,week,image,updated_by,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
     ON CONFLICT (product_id) DO UPDATE SET enabled=EXCLUDED.enabled,name=EXCLUDED.name,description=EXCLUDED.description,
       long_description=EXCLUDED.long_description,ingredients=EXCLUDED.ingredients,price_pence=EXCLUDED.price_pence,
       category=EXCLUDED.category,week=EXCLUDED.week,image=EXCLUDED.image,
       updated_by=EXCLUDED.updated_by,updated_at=now()`,
    [input.productId,input.enabled,input.name||null,input.description||null,input.longDescription||null,input.ingredients||null,input.pricePence??null,input.category||null,input.week??null,input.image||null,input.userId||null]
  );
}
