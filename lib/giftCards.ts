import crypto from "node:crypto";
import { db } from "./db";
import { ensureCouponSchema } from "./coupons";
import { sendMail } from "./mail";

function giftCode(){
  const raw=crypto.randomBytes(9).toString("hex").toUpperCase();
  return "SKG-"+raw.slice(0,6)+"-"+raw.slice(6,12)+"-"+raw.slice(12,18);
}

async function createGiftCoupon(amountPence:number){
  for(let attempt=0;attempt<5;attempt++){
    const code=giftCode();
    try{
      const result=await db().query(
        `INSERT INTO coupons
          (code,description,discount_type,amount,enabled,source,minimum_amount_pence,free_shipping)
         VALUES ($1,$2,'fixed_cart',$3,true,'gift_card',0,false)
         RETURNING id,code,amount`,
        [code,"Simple Kitchen e-gift card",amountPence/100]
      );
      return result.rows[0];
    }catch(error){
      if(attempt===4) throw error;
    }
  }
  throw new Error("Unable to generate gift card.");
}

export async function issueGiftCardsBySession(sessionId:string){
  await ensureCouponSchema();
  const orderResult=await db().query(
    "SELECT id,customer,status FROM orders WHERE stripe_session_id=$1 LIMIT 1",
    [sessionId]
  );
  const order=orderResult.rows[0];
  if(!order||order.status!=="paid") return [];

  const items=await db().query(
    `SELECT product_id,name,unit_price_pence,quantity
     FROM order_items
     WHERE order_id=$1 AND (product_id='358' OR product_id LIKE '358-%')`,
    [order.id]
  );
  if(!items.rows.length) return [];

  const customer=order.customer||{};
  const recipientEmail=String(customer.giftRecipientEmail||customer.email||"").trim();
  const recipientName=String(customer.giftRecipientName||"").trim();
  const purchaserName=String(customer.name||"").trim();
  const giftMessage=String(customer.giftMessage||"").trim();

  const existing=await db().query(
    "SELECT code,amount FROM coupons WHERE source='gift_card' AND description LIKE $1 ORDER BY created_at",
    ["%order "+String(order.id)+"%"]
  );
  if(existing.rows.length) return existing.rows;

  const issued:{code:string;amount:number}[]=[];
  for(const item of items.rows){
    for(let index=0;index<Number(item.quantity||0);index++){
      const gift=await createGiftCoupon(Number(item.unit_price_pence||0));
      await db().query(
        "UPDATE coupons SET description=$2 WHERE id=$1",
        [gift.id,"Simple Kitchen e-gift card · order "+String(order.id)]
      );
      issued.push({code:String(gift.code),amount:Number(gift.amount)});
    }
  }

  if(recipientEmail&&issued.length){
    const cards=issued.map((gift)=>
      '<div style="border:1px solid #d9e2ce;border-radius:12px;padding:16px;margin:12px 0">'+
      '<strong style="font-size:20px">£'+gift.amount.toFixed(2)+'</strong>'+
      '<div style="font-family:monospace;font-size:18px;margin-top:8px">'+gift.code+'</div></div>'
    ).join("");
    const intro=recipientName?"<p>Hi "+recipientName+",</p>":"";
    const from=purchaserName?"<p>This e-gift card was sent to you by "+purchaserName+".</p>":"";
    const note=giftMessage?"<blockquote style=\"margin:18px 0;padding:12px 16px;border-left:4px solid #738563\">"+giftMessage.replace(/[<>&]/g,(char)=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[char]||char))+"</blockquote>":"";
    await sendMail(
      recipientEmail,
      "Your Simple Kitchen e-gift card",
      '<h2>Your Simple Kitchen e-gift card</h2>'+intro+from+note+cards+
      '<p>Enter the gift-card code in the coupon box at checkout. Any unused balance remains on the code for a future order.</p>'
    );
  }

  return issued;
}
