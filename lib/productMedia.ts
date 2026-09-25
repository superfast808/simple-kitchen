import { db } from "./db";

export type ProductMedia={
  id:string;
  productId:string;
  urlPath:string;
  altText:string;
  sortOrder:number;
  isPrimary:boolean;
  source:string;
  originalUrl?:string|null;
};

let schemaReady:Promise<void>|null=null;
export async function ensureProductMediaSchema(){
  if(!schemaReady){
    schemaReady=db().query(`
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
      );
      CREATE INDEX IF NOT EXISTS product_media_product_idx ON product_media (product_id,sort_order);
    `).then(()=>undefined);
  }
  await schemaReady;
}

function mapRow(row:any):ProductMedia{
  return {
    id:String(row.id),
    productId:String(row.product_id),
    urlPath:String(row.url_path),
    altText:String(row.alt_text||""),
    sortOrder:Number(row.sort_order||0),
    isPrimary:Boolean(row.is_primary),
    source:String(row.source||"admin"),
    originalUrl:row.original_url?String(row.original_url):null
  };
}

export async function getProductMedia(productId:string){
  await ensureProductMediaSchema();
  const result=await db().query(
    `SELECT * FROM product_media WHERE product_id=$1
     ORDER BY is_primary DESC,sort_order ASC,created_at ASC`,
    [productId]
  );
  return result.rows.map(mapRow);
}

export async function getAllProductMedia(){
  await ensureProductMediaSchema();
  const result=await db().query(
    `SELECT * FROM product_media ORDER BY product_id,is_primary DESC,sort_order ASC,created_at ASC`
  );
  const map=new Map<string,ProductMedia[]>();
  for(const row of result.rows){
    const item=mapRow(row);
    const list=map.get(item.productId)||[];
    list.push(item);
    map.set(item.productId,list);
  }
  return map;
}

export async function addProductMedia(input:{
  productId:string;urlPath:string;altText?:string;source?:string;originalUrl?:string|null;isPrimary?:boolean;
}){
  await ensureProductMediaSchema();
  const count=await db().query("SELECT COUNT(*)::int AS count FROM product_media WHERE product_id=$1",[input.productId]);
  const primary=input.isPrimary===true||Number(count.rows[0]?.count||0)===0;
  if(primary) await db().query("UPDATE product_media SET is_primary=false WHERE product_id=$1",[input.productId]);
  const result=await db().query(
    `INSERT INTO product_media (product_id,url_path,alt_text,sort_order,is_primary,source,original_url)
     VALUES ($1,$2,$3,(SELECT COALESCE(MAX(sort_order),-1)+1 FROM product_media WHERE product_id=$1),$4,$5,$6)
     ON CONFLICT (product_id,url_path) DO UPDATE SET
       alt_text=EXCLUDED.alt_text,source=EXCLUDED.source,original_url=EXCLUDED.original_url,updated_at=now()
     RETURNING *`,
    [input.productId,input.urlPath,input.altText||"",primary,input.source||"admin",input.originalUrl||null]
  );
  return mapRow(result.rows[0]);
}

export async function updateProductMediaOrder(productId:string,items:{id:string;sortOrder:number;isPrimary:boolean;altText?:string}[]){
  await ensureProductMediaSchema();
  await db().query("UPDATE product_media SET is_primary=false WHERE product_id=$1",[productId]);
  for(const item of items){
    await db().query(
      `UPDATE product_media SET sort_order=$3,is_primary=$4,alt_text=COALESCE($5,alt_text),updated_at=now()
       WHERE id=$2 AND product_id=$1`,
      [productId,item.id,Math.max(0,Math.round(item.sortOrder)),item.isPrimary,item.altText??null]
    );
  }
  return getProductMedia(productId);
}

export async function deleteProductMedia(productId:string,mediaId:string){
  await ensureProductMediaSchema();
  const result=await db().query(
    "DELETE FROM product_media WHERE id=$1 AND product_id=$2 RETURNING url_path,is_primary",
    [mediaId,productId]
  );
  if(!result.rowCount) return null;
  if(result.rows[0].is_primary){
    await db().query(
      `UPDATE product_media SET is_primary=true
       WHERE id=(SELECT id FROM product_media WHERE product_id=$1 ORDER BY sort_order,created_at LIMIT 1)`,
      [productId]
    );
  }
  return String(result.rows[0].url_path);
}
