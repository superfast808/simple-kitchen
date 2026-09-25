import { DateTime } from "luxon";
import { db } from "./db";
import { config } from "./config";
import { getAdminSecret,getAdminSetting } from "./adminSettings";

const ZONE="Europe/London";

let schemaReady:Promise<void>|null=null;
async function ensureSmsSchema(){
  if(!schemaReady){
    schemaReady=db().query(`
      CREATE TABLE IF NOT EXISTS sms_audience (
        id bigserial PRIMARY KEY,
        phone_normalized text UNIQUE NOT NULL,
        phone_raw text,
        email text,
        first_name text,
        last_name text,
        last_order_at timestamptz,
        active_subscription boolean NOT NULL DEFAULT false,
        last_reminder_week date,
        last_reminder_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `).then(()=>undefined);
  }
  await schemaReady;
}

export function normalisePhone(value:string){
  let phone=(value||"").trim().replace(/[\s()-]/g,"");
  if(!phone) return "";
  if(phone.startsWith("00")) phone="+"+phone.slice(2);
  if(phone.startsWith("07")) phone="+44"+phone.slice(1);
  else if(phone.startsWith("447")) phone="+"+phone;
  return phone;
}

function splitName(name:string){
  const parts=(name||"").trim().split(/\s+/).filter(Boolean);
  return {firstName:parts[0]||"",lastName:parts.length>1?parts.slice(1).join(" "):""};
}

export async function upsertSmsAudience(input:{
  phone:string;email?:string;firstName?:string;lastName?:string;lastOrderAt?:string|Date;activeSubscription?:boolean;
}){
  await ensureSmsSchema();
  const normalised=normalisePhone(input.phone);
  if(!normalised) return false;
  await db().query(
    `INSERT INTO sms_audience
      (phone_normalized,phone_raw,email,first_name,last_name,last_order_at,active_subscription)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (phone_normalized) DO UPDATE SET
       phone_raw=EXCLUDED.phone_raw,
       email=COALESCE(NULLIF(EXCLUDED.email,''),sms_audience.email),
       first_name=COALESCE(NULLIF(EXCLUDED.first_name,''),sms_audience.first_name),
       last_name=COALESCE(NULLIF(EXCLUDED.last_name,''),sms_audience.last_name),
       last_order_at=GREATEST(COALESCE(sms_audience.last_order_at,'epoch'::timestamptz),COALESCE(EXCLUDED.last_order_at,'epoch'::timestamptz)),
       active_subscription=CASE WHEN EXCLUDED.active_subscription THEN true ELSE sms_audience.active_subscription END,
       updated_at=now()`,
    [normalised,input.phone,input.email||"",input.firstName||"",input.lastName||"",input.lastOrderAt||null,input.activeSubscription===true]
  );
  return true;
}

export async function recordPaidOrderAudienceBySession(sessionId:string){
  await ensureSmsSchema();
  const result=await db().query("SELECT customer,created_at FROM orders WHERE stripe_session_id=$1 LIMIT 1",[sessionId]);
  const row=result.rows[0];
  if(!row) return false;
  const customer=row.customer||{};
  const names=splitName(String(customer.name||""));
  return upsertSmsAudience({
    phone:String(customer.phone||""),email:String(customer.email||""),
    firstName:names.firstName,lastName:names.lastName,lastOrderAt:row.created_at
  });
}

export async function setAudienceSubscriptionByEmail(email:string,active:boolean){
  await ensureSmsSchema();
  if(!email) return;
  await db().query("UPDATE sms_audience SET active_subscription=$2,updated_at=now() WHERE lower(email)=lower($1)",[email,active]);
}

async function smsSettings(){
  const [enabled,lookbackDays,message,username,apiKey,from]=await Promise.all([
    getAdminSetting("sms_enabled",process.env.SMS_REMINDERS_ENABLED==="true"),
    getAdminSetting("sms_lookback_days",Number.parseInt(process.env.SMS_REMINDER_LOOKBACK_DAYS||"90",10)||90),
    getAdminSetting("sms_message",process.env.SMS_REMINDER_MESSAGE||"Hi {first_name}, this week's Simple Kitchen menu is live. Order at {shop_url}"),
    getAdminSetting("clicksend_username",process.env.CLICKSEND_USERNAME||""),
    getAdminSecret("clicksend_api_key",process.env.CLICKSEND_API_KEY||""),
    getAdminSetting("clicksend_from",process.env.CLICKSEND_FROM||"")
  ]);
  return {
    enabled:Boolean(enabled),
    lookbackDays:Math.max(1,Math.min(365,Number(lookbackDays)||90)),
    message:String(message),
    username:String(username),
    apiKey:String(apiKey),
    from:String(from)
  };
}

export async function reminderCandidates(at=DateTime.now().setZone(ZONE)){
  await ensureSmsSchema();
  const settings=await smsSettings();
  const weekStart=at.startOf("week");
  const lookbackStart=at.minus({days:settings.lookbackDays});
  const result=await db().query(
    `SELECT phone_normalized,email,first_name,last_name,last_order_at
     FROM sms_audience
     WHERE last_order_at >= $1
       AND last_order_at < $2
       AND active_subscription=false
       AND NOT EXISTS (
         SELECT 1 FROM subscriptions s
         WHERE s.status='active' AND lower(s.customer_email)=lower(sms_audience.email)
       )
       AND (last_reminder_week IS NULL OR last_reminder_week<>$3::date)
     ORDER BY last_order_at DESC`,
    [lookbackStart.toUTC().toISO(),weekStart.toUTC().toISO(),weekStart.toISODate()]
  );
  return {weekStart:weekStart.toISODate()||"",lookbackDays:settings.lookbackDays,rows:result.rows};
}

export async function clickSendConfigured(){
  const settings=await smsSettings();
  return Boolean(settings.username&&settings.apiKey);
}

function renderMessage(row:{first_name?:string;last_name?:string},template:string){
  return template
    .replaceAll("{first_name}",row.first_name||"")
    .replaceAll("{last_name}",row.last_name||"")
    .replaceAll("{shop_name}","Simple Kitchen")
    .replaceAll("{shop_url}",config.siteUrl);
}

async function sendClickSend(to:string,body:string,settings:Awaited<ReturnType<typeof smsSettings>>){
  if(!settings.username||!settings.apiKey) throw new Error("ClickSend is not configured.");
  const auth=Buffer.from(settings.username+":"+settings.apiKey).toString("base64");
  const message:{body:string;to:string;source:string;from?:string}={body,to,source:"simple-kitchen"};
  if(settings.from) message.from=settings.from;
  const response=await fetch("https://rest.clicksend.com/v3/sms/send",{
    method:"POST",
    headers:{authorization:"Basic "+auth,"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify({messages:[message]})
  });
  if(!response.ok){
    const text=await response.text().catch(()=>"");
    throw new Error("ClickSend "+response.status+": "+text.slice(0,250));
  }
  return true;
}

export async function runSmsReminders(options:{dryRun?:boolean;force?:boolean}={}){
  const [candidates,settings]=await Promise.all([reminderCandidates(),smsSettings()]);
  if(options.dryRun){
    return {
      dryRun:true,weekStart:candidates.weekStart,lookbackDays:candidates.lookbackDays,
      candidates:candidates.rows.map((row)=>({
        phone:row.phone_normalized,email:row.email,firstName:row.first_name,lastName:row.last_name,
        lastOrderAt:row.last_order_at,message:renderMessage(row,settings.message)
      }))
    };
  }

  if(!settings.enabled&&!options.force){
    return {dryRun:false,disabled:true,candidates:candidates.rows.length,sent:0,failed:0};
  }

  let sent=0;
  let failed=0;
  const failures:{phone:string;error:string}[]=[];
  for(const row of candidates.rows){
    try{
      await sendClickSend(row.phone_normalized,renderMessage(row,settings.message),settings);
      await db().query(
        "UPDATE sms_audience SET last_reminder_week=$2::date,last_reminder_at=now(),updated_at=now() WHERE phone_normalized=$1",
        [row.phone_normalized,candidates.weekStart]
      );
      sent++;
    }catch(error){
      failed++;
      failures.push({phone:row.phone_normalized,error:error instanceof Error?error.message:"SMS failed"});
    }
  }
  return {dryRun:false,disabled:false,candidates:candidates.rows.length,sent,failed,failures};
}
