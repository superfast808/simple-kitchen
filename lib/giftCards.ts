import crypto from "node:crypto";
import { db,transaction } from "./db";
import { ensureCouponSchema } from "./coupons";
import { sendMail } from "./mail";

let giftSchemaReady:Promise<void>|null=null;
async function ensureGiftSchema(){
  await ensureCouponSchema();
  if(!giftSchemaReady){
    giftSchemaReady=db().query(`
      CREATE TABLE IF NOT EXISTS gift_card_issuances (
        id bigserial PRIMARY KEY,
        order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        order_item_id bigint NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
        sequence_no integer NOT NULL,
        coupon_id uuid REFERENCES coupons(id) ON DELETE RESTRICT,
        recipient_email text,
        delivery_claimed_at timestamptz,
        delivered_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(order_item_id,sequence_no)
      )
    `).then(()=>undefined);
  }
  await giftSchemaReady;
}

function giftCode(){
  const raw=crypto.randomBytes(12).toString("hex").toUpperCase();
  return "SKG-"+raw.slice(0,6)+"-"+raw.slice(6,12)+"-"+raw.slice(12,18)+"-"+raw.slice(18,24);
}

function escapeHtml(value:string){
  return value.replace(/[<>&"']/g,(char)=>({
    "<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;","'":"&#39;"
  }[char]||char));
}

export async function issueGiftCardsBySession(sessionId:string){
  await ensureGiftSchema();

  const orderResult=await db().query(
    "SELECT id,customer,status FROM orders WHERE stripe_session_id=$1 LIMIT 1",
    [sessionId]
  );
  const order=orderResult.rows[0];
  if(!order||order.status!=="paid") return [];

  const itemResult=await db().query(
    `SELECT id,product_id,name,unit_price_pence,quantity
     FROM order_items
     WHERE order_id=$1 AND (product_id='358' OR product_id LIKE '358-%')
     ORDER BY id`,
    [order.id]
  );
  if(!itemResult.rows.length) return [];

  const customer=order.customer||{};
  const recipientEmail=String(customer.giftRecipientEmail||customer.email||"").trim();
  const recipientName=String(customer.giftRecipientName||"").trim();
  const purchaserName=String(customer.name||"").trim();
  const giftMessage=String(customer.giftMessage||"").trim();

  for(const item of itemResult.rows){
    for(let sequence=1;sequence<=Number(item.quantity||0);sequence++){
      await transaction(async(client)=>{
        const slot=await client.query(
          `INSERT INTO gift_card_issuances (order_id,order_item_id,sequence_no,recipient_email)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (order_item_id,sequence_no) DO NOTHING
           RETURNING id`,
          [order.id,item.id,sequence,recipientEmail]
        );
        if(!slot.rowCount) return;

        const code=giftCode();
        const coupon=await client.query(
          `INSERT INTO coupons
            (code,description,discount_type,amount,enabled,source,minimum_amount_pence,free_shipping)
           VALUES ($1,$2,'fixed_cart',$3,true,'gift_card',0,false)
           RETURNING id`,
          [code,"Simple Kitchen e-gift card · order "+String(order.id),Number(item.unit_price_pence||0)/100]
        );
        await client.query(
          "UPDATE gift_card_issuances SET coupon_id=$2 WHERE id=$1",
          [slot.rows[0].id,coupon.rows[0].id]
        );
      });
    }
  }

  const claimed=await db().query(
    `UPDATE gift_card_issuances g
     SET delivery_claimed_at=now()
     FROM coupons c
     WHERE g.coupon_id=c.id
       AND g.order_id=$1
       AND g.delivered_at IS NULL
       AND (g.delivery_claimed_at IS NULL OR g.delivery_claimed_at<now()-interval '10 minutes')
     RETURNING g.id,c.code,c.amount`,
    [order.id]
  );

  if(!claimed.rows.length) {
    const all=await db().query(
      `SELECT c.code,c.amount
       FROM gift_card_issuances g JOIN coupons c ON c.id=g.coupon_id
       WHERE g.order_id=$1 ORDER BY g.id`,
      [order.id]
    );
    return all.rows;
  }

  try{
    if(recipientEmail){
      const cards=claimed.rows.map((gift)=>
        '<div style="border:1px solid #d9e2ce;border-radius:12px;padding:16px;margin:12px 0">'+
        '<strong style="font-size:20px">£'+Number(gift.amount).toFixed(2)+'</strong>'+
        '<div style="font-family:monospace;font-size:18px;margin-top:8px">'+escapeHtml(String(gift.code))+'</div></div>'
      ).join("");
      const intro=recipientName?"<p>Hi "+escapeHtml(recipientName)+",</p>":"";
      const from=purchaserName?"<p>This e-gift card was sent to you by "+escapeHtml(purchaserName)+".</p>":"";
      const note=giftMessage?'<blockquote style="margin:18px 0;padding:12px 16px;border-left:4px solid #738563">'+escapeHtml(giftMessage)+"</blockquote>":"";
      const sent=await sendMail(
        recipientEmail,
        "Your Simple Kitchen e-gift card",
        "<h2>Your Simple Kitchen e-gift card</h2>"+intro+from+note+cards+
        "<p>Enter the gift-card code in the coupon box at checkout. Any unused balance remains on the code for a future order.</p>"
      );
      if(!sent) throw new Error("Gift card email could not be sent because SMTP is not configured.");
    }

    await db().query(
      "UPDATE gift_card_issuances SET delivered_at=now(),delivery_claimed_at=NULL WHERE id=ANY($1::bigint[])",
      [claimed.rows.map((row)=>Number(row.id))]
    );
  }catch(error){
    await db().query(
      "UPDATE gift_card_issuances SET delivery_claimed_at=NULL WHERE id=ANY($1::bigint[])",
      [claimed.rows.map((row)=>Number(row.id))]
    );
    throw error;
  }

  return claimed.rows;
}
