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

export async function getRuntimeProducts(){
  try{
    await ensureSchema();
    const result=await db().query("SELECT product_id,enabled,name,description,price_pence,category,week,image FROM product_overrides");
    const map=new Map(result.rows.map((row)=>[String(row.product_id),row as Override]));
    return products.map((product)=>apply(product,map.get(product.id))).filter(Boolean) as Product[];
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
  if(!base) return null;
  const overrideId=id.includes("-")?id.split("-")[0]:id;
  try{
    await ensureSchema();
    const result=await db().query("SELECT product_id,enabled,name,description,price_pence,category,week,image FROM product_overrides WHERE product_id=$1",[overrideId]);
    return apply(base,result.rows[0] as Override|undefined);
  }catch{
    return base;
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
