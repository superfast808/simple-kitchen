import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { getStripe } from "@/lib/stripe";

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  const body=await request.json() as {action?:string};
  const result=await db().query("SELECT * FROM subscriptions WHERE id=$1 LIMIT 1",[id]);
  const subscription=result.rows[0];
  if(!subscription) return NextResponse.json({error:"Subscription not found."},{status:404});

  if(body.action==="resend"){
    const url=config.siteUrl+"/subscription-select?token="+subscription.selection_token;
    const sent=await sendMail(subscription.customer_email,"Choose your Simple Kitchen meals",'<h2>Your meal selection link</h2><p><a href="'+url+'">Choose your meals</a></p>');
    if(!sent) return NextResponse.json({error:"Email is not configured."},{status:503});
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"subscription.link_sent",entityType:"subscription",entityId:id,ipAddress:requestIp(request)});
    return NextResponse.json({ok:true});
  }

  if(body.action==="cancel"){
    if(subscription.status!=="active") return NextResponse.json({error:"Subscription is not active."},{status:409});
    const stripe=await getStripe();
    await stripe.subscriptions.cancel(String(subscription.stripe_subscription_id));
    await db().query("UPDATE subscriptions SET status='cancelled',updated_at=now() WHERE id=$1",[id]);
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"subscription.cancel",entityType:"subscription",entityId:id,detail:{stripeSubscriptionId:subscription.stripe_subscription_id},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true});
  }

  return NextResponse.json({error:"Unknown action."},{status:400});
}
