import path from "node:path";
import crypto from "node:crypto";
import { mkdir,writeFile } from "node:fs/promises";
import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";

export const runtime="nodejs";

const KEYS=new Set(["home","order","subscriptions","story","find-us","checkout","account"]);
const TYPES:Record<string,string>={
  "image/jpeg":".jpg","image/png":".png","image/webp":".webp","image/avif":".avif"
};

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin","operator"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const form=await request.formData();
    const page=String(form.get("page")||"");
    const file=form.get("file");
    if(!KEYS.has(page)) throw new Error("Invalid hero page.");
    if(!(file instanceof File)) throw new Error("Choose an image.");
    const ext=TYPES[file.type];
    if(!ext) throw new Error("Use a JPG, PNG, WebP or AVIF image.");
    if(file.size>15*1024*1024) throw new Error("Hero image must be 15 MB or smaller.");

    const buffer=Buffer.from(await file.arrayBuffer());
    const hash=crypto.createHash("sha1").update(buffer).digest("hex").slice(0,12);
    const dir=path.join(process.cwd(),"data","media","site","heroes");
    await mkdir(dir,{recursive:true});
    const filename=page+"-"+hash+ext;
    await writeFile(path.join(dir,filename),buffer);
    const url="/media/site/heroes/"+filename;

    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"content.hero_upload",entityType:"hero",entityId:page,detail:{url},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true,url});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to upload hero image."},{status:400});
  }
}
