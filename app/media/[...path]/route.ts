import path from "node:path";
import { readFile,stat } from "node:fs/promises";
import { NextRequest,NextResponse } from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const MIME:Record<string,string>={
  ".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",".gif":"image/gif",".avif":"image/avif"
};

export async function GET(_request:NextRequest,{params}:{params:Promise<{path:string[]}>}){
  const {path:segments}=await params;
  const root=path.resolve(process.cwd(),"data","media");
  const safeSegments=(segments||[]).map((segment)=>segment.replace(/[^a-zA-Z0-9._-]/g,""));
  const target=path.resolve(root,...safeSegments);
  if(!target.startsWith(root+path.sep)) return new NextResponse("Not found",{status:404});
  const ext=path.extname(target).toLowerCase();
  const contentType=MIME[ext];
  if(!contentType) return new NextResponse("Not found",{status:404});
  try{
    const info=await stat(target);
    if(!info.isFile()) return new NextResponse("Not found",{status:404});
    const body=await readFile(target);
    return new NextResponse(body,{
      headers:{
        "content-type":contentType,
        "content-length":String(info.size),
        "cache-control":"public, max-age=86400, stale-while-revalidate=604800",
        "x-content-type-options":"nosniff"
      }
    });
  }catch{
    return new NextResponse("Not found",{status:404});
  }
}
