import pg from "pg";

const {Pool}=pg;
const base=(process.env.WOO_SOURCE_URL||"https://simplekitchenprep.com").replace(/\/$/,"");
const key=process.env.WOO_CONSUMER_KEY;
const secret=process.env.WOO_CONSUMER_SECRET;
const databaseUrl=process.env.DATABASE_URL;

if(!key||!secret) throw new Error("Woo credentials are missing from .env");
if(!databaseUrl) throw new Error("DATABASE_URL is missing from .env");

const auth=Buffer.from(key+":"+secret).toString("base64");
const headers={authorization:"Basic "+auth,"user-agent":"Simple-Kitchen-SMS-Migration/1.0",accept:"application/json"};
const pool=new Pool({connectionString:databaseUrl});

function normalisePhone(value){
  let phone=(value||"").trim().replace(/[\s()-]/g,"");
  if(!phone) return "";
  if(phone.startsWith("00")) phone="+"+phone.slice(2);
  if(phone.startsWith("07")) phone="+44"+phone.slice(1);
  else if(phone.startsWith("447")) phone="+"+phone;
  return phone;
}

function api(endpoint,params={}){
  const url=new URL(base+"/wp-json/wc/v3/"+endpoint.replace(/^\//,""));
  for(const [name,value] of Object.entries(params)) if(value!=null) url.searchParams.set(name,String(value));
  return url;
}

async function get(url,optional=false){
  const response=await fetch(url,{headers});
  if(optional&&[401,403,404].includes(response.status)) return null;
  if(!response.ok) throw new Error(response.status+" "+response.statusText+" for "+url.pathname);
  return response.json();
}

async function paged(endpoint,params={},optional=false){
  const rows=[];
  for(let page=1;;page++){
    const batch=await get(api(endpoint,{...params,per_page:100,page}),optional);
    if(batch==null) return null;
    if(!Array.isArray(batch)) throw new Error("Unexpected response from "+endpoint);
    rows.push(...batch);
    if(batch.length<100) break;
  }
  return rows;
}

async function ensureSchema(){
  await pool.query(`
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
  `);
}

async function main(){
  await ensureSchema();
  const days=Math.max(1,Number.parseInt(process.env.SMS_REMINDER_LOOKBACK_DAYS||"90",10)||90);
  const after=new Date(Date.now()-days*86400000).toISOString();
  const orders=(await paged("orders",{after,orderby:"date",order:"asc"}))||[];
  const eligibleStatuses=new Set(["processing","completed","on-hold"]);
  const audience=new Map();

  for(const order of orders){
    if(!eligibleStatuses.has(order.status)) continue;
    const billing=order.billing||{};
    const phone=normalisePhone(billing.phone||"");
    if(!phone) continue;
    const date=order.date_created_gmt?new Date(order.date_created_gmt+"Z"):new Date(order.date_created||0);
    const existing=audience.get(phone);
    if(!existing||date>existing.lastOrderAt){
      audience.set(phone,{
        phone,
        phoneRaw:billing.phone||"",
        email:billing.email||"",
        firstName:billing.first_name||"",
        lastName:billing.last_name||"",
        lastOrderAt:date
      });
    }
  }

  const subscriptions=(await paged("subscriptions",{},true))||[];
  const activeEmails=new Set();
  const activePhones=new Set();
  for(const subscription of subscriptions){
    if(!["active","pending-cancel"].includes(subscription.status)) continue;
    const billing=subscription.billing||{};
    if(billing.email) activeEmails.add(String(billing.email).toLowerCase());
    const phone=normalisePhone(billing.phone||"");
    if(phone) activePhones.add(phone);
  }

  let imported=0;
  let activeSubscribers=0;
  const markThisWeek=process.env.SMS_IMPORT_ASSUME_REMINDER_SENT_THIS_WEEK==="true";
  const today=new Date();
  const londonDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"}).formatToParts(today);
  const part=Object.fromEntries(londonDate.map((p)=>[p.type,p.value]));
  const local=new Date(part.year+"-"+part.month+"-"+part.day+"T12:00:00Z");
  const weekday=(local.getUTCDay()+6)%7;
  local.setUTCDate(local.getUTCDate()-weekday);
  const weekStart=local.toISOString().slice(0,10);

  for(const row of audience.values()){
    const active=activePhones.has(row.phone)||activeEmails.has(String(row.email).toLowerCase());
    if(active) activeSubscribers++;
    await pool.query(
      `INSERT INTO sms_audience
        (phone_normalized,phone_raw,email,first_name,last_name,last_order_at,active_subscription,last_reminder_week)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (phone_normalized) DO UPDATE SET
         phone_raw=EXCLUDED.phone_raw,
         email=EXCLUDED.email,
         first_name=EXCLUDED.first_name,
         last_name=EXCLUDED.last_name,
         last_order_at=GREATEST(sms_audience.last_order_at,EXCLUDED.last_order_at),
         active_subscription=EXCLUDED.active_subscription,
         last_reminder_week=COALESCE(EXCLUDED.last_reminder_week,sms_audience.last_reminder_week),
         updated_at=now()`,
      [row.phone,row.phoneRaw,row.email,row.firstName,row.lastName,row.lastOrderAt,active,markThisWeek?weekStart:null]
    );
    imported++;
  }

  console.log(JSON.stringify({
    lookbackDays:days,
    wooOrdersScanned:orders.length,
    uniqueSmsAudience:imported,
    activeSubscribersExcluded:activeSubscribers,
    subscriptionsEndpointAvailable:subscriptions.length>0,
    markedReminderSentThisWeek:markThisWeek
  },null,2));
}

try{
  await main();
}finally{
  await pool.end();
}
