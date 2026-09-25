import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { getAdminSecret,setAdminSecret } from "@/lib/adminSettings";
import { getStripe } from "@/lib/stripe";

function modeFromKey(key:string){
  if(key.startsWith("sk_live_")) return "live";
  if(key.startsWith("sk_test_")) return "test";
  return key?"configured":"missing";
}

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});

  try{
    const body=await request.json() as {action?:string;stripeSecret?:string;stripeWebhookSecret?:string};
    if(body.action==="save"){
      if(String(body.stripeSecret||"")) await setAdminSecret("stripe_secret_key",String(body.stripeSecret),session.userId);
      if(String(body.stripeWebhookSecret||"")) await setAdminSecret("stripe_webhook_secret",String(body.stripeWebhookSecret),session.userId);
      const [key,webhook]=await Promise.all([
        getAdminSecret("stripe_secret_key",process.env.STRIPE_SECRET_KEY||""),
        getAdminSecret("stripe_webhook_secret",process.env.STRIPE_WEBHOOK_SECRET||"")
      ]);
      await auditAdmin({userId:session.userId,actorEmail:session.email,action:"stripe.credentials_update",entityType:"settings",detail:{mode:modeFromKey(key)},ipAddress:requestIp(request)});
      return NextResponse.json({ok:true,configured:Boolean(key),webhookConfigured:Boolean(webhook),mode:modeFromKey(key)});
    }

    if(body.action==="test"){
      const stripe=await getStripe();
      const balance=await stripe.balance.retrieve();
      const currencies=Array.from(new Set([...(balance.available||[]),...(balance.pending||[])].map((item)=>item.currency))).slice(0,8);
      await auditAdmin({userId:session.userId,actorEmail:session.email,action:"stripe.connection_test",entityType:"integration",detail:{livemode:balance.livemode},ipAddress:requestIp(request)});
      return NextResponse.json({ok:true,livemode:balance.livemode,currencies});
    }

    return NextResponse.json({error:"Unknown Stripe action."},{status:400});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Stripe action failed."},{status:400});
  }
}
