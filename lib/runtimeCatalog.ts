import { db } from "./db";
import { products,productById } from "./catalog";
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
        price_pence integer,
        category text,
        week integer,
        image text,
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `).then(()=>undefined);
  }
  await schemaReady;
}

type Override={
  product_id:string;enabled:boolean|null;name:string|null;description:string|null;price_pence:number|null;
  category:string|null;week:number|null;image:string|null;
};

function apply(product:Product,override?:Override):Product|null{
  if(override?.enabled===false) return null;
  return {
    ...product,
    name:override?.name||product.name,
    description:override?.description||product.description,
    price:override?.price_pence!=null?Number(override.price_pence)/100:product.price,
    category:(override?.category||product.category) as ProductCategory,
    weeks:override?.week!=null?[Number(override.week)]:product.weeks,
    image:override?.image||product.image
  };
}

function customProduct(row:Override):Product|null{
  if(row.enabled===false||!row.name||row.price_pence==null||!row.category||row.week==null) return null;
  return {
    id:row.product_id,
    name:row.name,
    description:row.description||"Chef-prepared Simple Kitchen meal.",
    price:Number(row.price_pence)/100,
    category:row.category as ProductCategory,
    weeks:[Number(row.week)],
    image:row.image||undefined
  };
}

export async function getRuntimeProducts(){
  try{
    await ensureSchema();
    const result=await db().query("SELECT product_id,enabled,name,description,price_pence,category,week,image FROM product_overrides");
    const overrides=result.rows as Override[];
    const map=new Map(overrides.map((row)=>[String(row.product_id),row]));
    const staticIds=new Set(products.map((product)=>product.id));
    const base=products.map((product)=>apply(product,map.get(product.id))).filter(Boolean) as Product[];
    const custom=overrides.filter((row)=>!staticIds.has(row.product_id)).map(customProduct).filter(Boolean) as Product[];
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
      const result=await db().query("SELECT product_id,enabled,name,description,price_pence,category,week,image FROM product_overrides WHERE product_id=$1",[overrideId]);
      return apply(base,result.rows[0] as Override|undefined);
    }
    const custom=await db().query("SELECT product_id,enabled,name,description,price_pence,category,week,image FROM product_overrides WHERE product_id=$1",[id]);
    return custom.rows[0]?customProduct(custom.rows[0] as Override):null;
  }catch{
    return base||null;
  }
}

export async function saveProductOverride(input:{
  productId:string;enabled:boolean|null;name?:string|null;description?:string|null;pricePence?:number|null;
  category?:string|null;week?:number|null;image?:string|null;userId?:string;
}){
  await ensureSchema();
  await db().query(
    `INSERT INTO product_overrides (product_id,enabled,name,description,price_pence,category,week,image,updated_by,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
     ON CONFLICT (product_id) DO UPDATE SET enabled=EXCLUDED.enabled,name=EXCLUDED.name,description=EXCLUDED.description,
       price_pence=EXCLUDED.price_pence,category=EXCLUDED.category,week=EXCLUDED.week,image=EXCLUDED.image,
       updated_by=EXCLUDED.updated_by,updated_at=now()`,
    [input.productId,input.enabled,input.name||null,input.description||null,input.pricePence??null,input.category||null,input.week??null,input.image||null,input.userId||null]
  );
}
