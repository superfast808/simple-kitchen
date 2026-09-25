import path from "node:path";
import crypto from "node:crypto";
import { mkdir,unlink,writeFile } from "node:fs/promises";
import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { addProductMedia,deleteProductMedia,getProductMedia,updateProductMediaOrder } from "@/lib/productMedia";

export const runtime="nodejs";

const TYPES:Record<string,string>={
  "image/jpeg":".jpg","image/png":".png","image/webp":".webp","image/gif":".gif","image/avif":".avif"
};

function safeId(value:string){return value.replace(/[^a-zA-Z0-9_-]/g,"-").slice(0,100);}

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin","operator"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  try{
    const form=await request.formData();
    const files=form.getAll("files").filter((item):item is File=>item instanceof File);
    if(!files.length) return NextResponse.json({error:"Choose at least one image."},{status:400});
    if(files.length>12) return NextResponse.json({error:"Upload a maximum of 12 images at once."},{status:400});

    const dir=path.join(process.cwd(),"data","media","products",safeId(id));
    await mkdir(dir,{recursive:true});
    const created=[];
    for(const file of files){
      const ext=TYPES[file.type];
      if(!ext) throw new Error("Unsupported image type: "+file.type);
      if(file.size>12*1024*1024) throw new Error(file.name+" is larger than 12 MB.");
      const filename=Date.now()+"-"+crypto.randomBytes(5).toString("hex")+ext;
      const target=path.join(dir,filename);
      await writeFile(target,Buffer.from(await file.arrayBuffer()),{flag:"wx"});
      created.push(await addProductMedia({
        productId:id,urlPath:"/media/products/"+safeId(id)+"/"+filename,
        altText:String(form.get("altText")||""),source:"admin"
      }));
    }
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"product.media_upload",entityType:"product",entityId:id,detail:{count:created.length},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true,media:await getProductMedia(id)});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to upload images."},{status:400});
  }
}

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin","operator"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  try{
    const body=await request.json() as {items?:{id:string;sortOrder:number;isPrimary:boolean;altText?:string}[]};
    if(!Array.isArray(body.items)) throw new Error("Invalid media order.");
    const media=await updateProductMediaOrder(id,body.items);
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"product.media_order",entityType:"product",entityId:id,ipAddress:requestIp(request)});
    return NextResponse.json({ok:true,media});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to update images."},{status:400});
  }
}

export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin","operator"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  const mediaId=request.nextUrl.searchParams.get("mediaId")||"";
  if(!mediaId) return NextResponse.json({error:"Media ID is required."},{status:400});
  try{
    const urlPath=await deleteProductMedia(id,mediaId);
    if(!urlPath) return NextResponse.json({error:"Image not found."},{status:404});
    if(urlPath.startsWith("/media/products/")){
      const target=path.join(process.cwd(),"public",urlPath.replace(/^\//,""));
      await unlink(target).catch(()=>undefined);
    }
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"product.media_delete",entityType:"product",entityId:id,detail:{mediaId},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true,media:await getProductMedia(id)});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to delete image."},{status:400});
  }
}
