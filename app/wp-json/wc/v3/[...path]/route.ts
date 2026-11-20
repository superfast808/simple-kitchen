import { NextRequest,NextResponse } from "next/server";
import {
  authenticate,createRefund,getOrder,getProduct,listOrders,listProducts,listRefunds,listVariations,
  systemStatus,updateOrder,WooError,wooErrorBody
} from "@/lib/kitchenApi";

export const dynamic="force-dynamic";

type Context={params:Promise<{path:string[]}>};

function json(body:unknown,total?:number,perPage?:number){
  const headers:Record<string,string>={"cache-control":"no-store"};
  if(total!==undefined&&perPage){
    headers["x-wp-total"]=String(total);
    headers["x-wp-totalpages"]=String(Math.max(1,Math.ceil(total/perPage)));
  }
  return NextResponse.json(body,{headers});
}

function idFrom(value:string|undefined){
  const id=Number(value);
  if(!Number.isSafeInteger(id)||id<1) throw new WooError("rest_no_route","No route was found matching the URL and request method.",404);
  return id;
}

function perPage(params:URLSearchParams){
  return Math.max(1,Math.min(100,Number.parseInt(params.get("per_page")||"10",10)||10));
}

async function handle(request:NextRequest,context:Context,method:"GET"|"POST"|"PUT"){
  try{
    authenticate(request);
    const {path}=await context.params;
    const params=request.nextUrl.searchParams;
    const [resource,id,sub]=path;
    const body=method==="GET"?{}:await request.json().catch(()=>({})) as Record<string,unknown>;

    if(resource==="orders"&&!id&&method==="GET"){
      const result=await listOrders(params);
      return json(result.orders,result.total,perPage(params));
    }
    if(resource==="orders"&&id&&!sub){
      if(method==="GET") return json(await getOrder(idFrom(id)));
      if(method==="PUT"||method==="POST") return json(await updateOrder(idFrom(id),body));
    }
    if(resource==="orders"&&id&&sub==="refunds"&&path.length===3){
      if(method==="GET") return json(await listRefunds(idFrom(id)));
      if(method==="POST") return NextResponse.json(await createRefund(idFrom(id),body),{status:201});
    }
    if(resource==="products"&&method==="GET"){
      if(!id){
        const result=await listProducts(params);
        return json(result.products,result.total,perPage(params));
      }
      if(sub==="variations"){
        const result=await listVariations(idFrom(id),params);
        return json(result.variations,result.total,perPage(params));
      }
      if(!sub) return json(await getProduct(idFrom(id)));
    }
    if(resource==="system_status"&&method==="GET") return json(systemStatus());
    throw new WooError("rest_no_route","No route was found matching the URL and request method.",404);
  }catch(error){
    if(error instanceof WooError) return NextResponse.json(wooErrorBody(error),{status:error.status});
    console.error("[kitchen-api]",error);
    const message=error instanceof Error?error.message:"Internal error";
    return NextResponse.json({code:"internal_server_error",message,data:{status:500}},{status:500});
  }
}

export async function GET(request:NextRequest,context:Context){return handle(request,context,"GET");}
export async function POST(request:NextRequest,context:Context){return handle(request,context,"POST");}
export async function PUT(request:NextRequest,context:Context){return handle(request,context,"PUT");}
