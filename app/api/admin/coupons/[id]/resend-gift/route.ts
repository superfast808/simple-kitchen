import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";

function escapeHtml(value:string){
  return value.replace(/[<>&"']/g,(char)=>({
    "<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;","'":"&#39;"
  }[char]||char));
}

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin","operator"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;

  try{
    const result=await db().query(
      `SELECT c.id,c.code,c.amount,c.source,g.id AS issuance_id,g.recipient_email,o.customer
       FROM coupons c
       JOIN gift_card_issuances g ON g.coupon_id=c.id
       JOIN orders o ON o.id=g.order_id
       WHERE c.id=$1
       LIMIT 1`,
      [id]
    );
    const row=result.rows[0];
    if(!row||row.source!=="gift_card") return NextResponse.json({error:"Gift card not found."},{status:404});
    const recipient=String(row.recipient_email||row.customer?.giftRecipientEmail||"").trim();
    if(!recipient) return NextResponse.json({error:"No recipient email is recorded for this gift card."},{status:400});

    const recipientName=String(row.customer?.giftRecipientName||"").trim();
    const purchaserName=String(row.customer?.name||"").trim();
    const giftMessage=String(row.customer?.giftMessage||"").trim();
    const intro=recipientName?"<p>Hi "+escapeHtml(recipientName)+",</p>":"";
    const from=purchaserName?"<p>This e-gift card was sent to you by "+escapeHtml(purchaserName)+".</p>":"";
    const note=giftMessage?'<blockquote style="margin:18px 0;padding:12px 16px;border-left:4px solid #738563">'+escapeHtml(giftMessage)+"</blockquote>":"";
    const card='<div style="border:1px solid #d9e2ce;border-radius:12px;padding:16px;margin:12px 0">'+
      '<strong style="font-size:20px">£'+Number(row.amount).toFixed(2)+' remaining</strong>'+
      '<div style="font-family:monospace;font-size:18px;margin-top:8px">'+escapeHtml(String(row.code))+'</div></div>';

    const sent=await sendMail(
      recipient,
      "Your Simple Kitchen e-gift card",
      "<h2>Your Simple Kitchen e-gift card</h2>"+intro+from+note+card+
      "<p>Enter this code in the coupon box at checkout. Any unused balance remains available for a future order.</p>"
    );
    if(!sent) return NextResponse.json({error:"SMTP is not configured."},{status:503});

    await db().query("UPDATE gift_card_issuances SET delivered_at=now(),delivery_claimed_at=NULL WHERE id=$1",[row.issuance_id]);
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"gift_card.resend",entityType:"coupon",entityId:id,detail:{recipient},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true,recipient,deliveredAt:new Date().toISOString()});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to resend gift card."},{status:500});
  }
}
