import path from "node:path";
import crypto from "node:crypto";
import { mkdir,unlink,writeFile } from "node:fs/promises";
import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { addProductMedia,clearProductMediaSource,getProductMedia } from "@/lib/productMedia";

export const runtime="nodejs";

function safeId(value:string){return value.replace(/[^a-zA-Z0-9_-]/g,"-").slice(0,100);}

function extensionFrom(contentType:string,url:string){
  const byType:Record<string,string>={
    "image/jpeg":".jpg","image/png":".png","image/webp":".webp","image/gif":".gif","image/avif":".avif"
  };
  if(byType[contentType]) return byType[contentType];
  const ext=path.extname(new URL(url).pathname).toLowerCase();
  return [".jpg",".jpeg",".png",".webp",".gif",".avif"].includes(ext)?(ext===".jpeg"?".jpg":ext):".jpg";
}

async function wooProduct(productId:string){
  const base=(process.env.WOO_SOURCE_URL||"https://simplekitchenprep.com").replace(/\/$/,"");
  const key=process.env.WOO_CONSUMER_KEY||"";
  const secret=process.env.WOO_CONSUMER_SECRET||"";
  if(!key||!secret) throw new Error("Woo migration credentials are not configured.");
  const authorization="Basic "+Buffer.from(key+":"+secret).toString("base64");
  const response=await fetch(base+"/wp-json/wc/v3/products/"+encodeURIComponent(productId)+"?context=edit",{
    headers:{authorization,accept:"application/json","user-agent":"Simple-Kitchen-Media-Migration/1.0"}
  });
  if(!response.ok) throw new Error("Woo product lookup failed: "+response.status+" "+response.statusText);
  return {base,product:await response.json()};
}

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin","operator"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;

  try{
    if(!/^\d+$/.test(id)) return NextResponse.json({error:"This product is not linked to a Woo product ID."},{status:400});
    const {base,product}=await wooProduct(id);
    const allowedHost=new URL(base).hostname.toLowerCase();
    const images=Array.isArray(product.images)?product.images.slice(0,12):[];
    if(!images.length) return NextResponse.json({error:"Woo has no images for this product."},{status:404});

    const dir=path.join(process.cwd(),"data","media","products",safeId(id));
    await mkdir(dir,{recursive:true});
    const oldWooPaths=await clearProductMediaSource(id,"woo");
    const existingAfterClear=await getProductMedia(id);
    const wooShouldBePrimary=existingAfterClear.length===0;
    for(const oldPath of oldWooPaths){
      if(oldPath.startsWith("/media/products/")){
        const target=path.join(process.cwd(),"data","media",oldPath.replace(/^\/media\//,""));
        await unlink(target).catch(()=>undefined);
      }
    }

    let imported=0;
    for(let index=0;index<images.length;index++){
      const source=String(images[index]?.src||"");
      if(!source) continue;
      const parsed=new URL(source);
      if(parsed.hostname.toLowerCase()!==allowedHost) throw new Error("Woo image host is outside the configured store domain.");
      const response=await fetch(parsed,{headers:{"user-agent":"Simple-Kitchen-Media-Migration/1.0"}});
      if(!response.ok) throw new Error("Image download failed: "+response.status+" "+response.statusText);
      const contentType=(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
      if(!contentType.startsWith("image/")) throw new Error("Woo returned a non-image file.");
      const buffer=Buffer.from(await response.arrayBuffer());
      if(buffer.length>15*1024*1024) throw new Error("Woo image is larger than 15 MB.");
      const ext=extensionFrom(contentType,source);
      const filename="woo-"+String(images[index]?.id||index+1)+"-"+crypto.createHash("sha1").update(buffer).digest("hex").slice(0,8)+ext;
      await writeFile(path.join(dir,filename),buffer);
      await addProductMedia({
        productId:id,
        urlPath:"/media/products/"+safeId(id)+"/"+filename,
        altText:String(images[index]?.alt||product.name||""),
        source:"woo",
        originalUrl:source,
        isPrimary:index===0&&wooShouldBePrimary
      });
      imported++;
    }

    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"product.media_import_woo",entityType:"product",entityId:id,detail:{imported},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true,imported,media:await getProductMedia(id)});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to import Woo images."},{status:500});
  }
}
