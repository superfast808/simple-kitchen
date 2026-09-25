import crypto from "node:crypto";
import { db } from "./db";
import { ensureAdminSchema } from "./adminAuth";

let settingsSchemaReady:Promise<void>|null=null;

async function ensureSettingsSchema(){
  await ensureAdminSchema();
  if(!settingsSchemaReady){
    settingsSchemaReady=db().query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        key text PRIMARY KEY,
        value jsonb,
        encrypted_value text,
        is_secret boolean NOT NULL DEFAULT false,
        description text,
        updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `).then(()=>undefined);
  }
  await settingsSchemaReady;
}

function encryptionKey(){
  const raw=process.env.ADMIN_ENCRYPTION_KEY||process.env.ADMIN_SESSION_SECRET;
  if(!raw||raw.length<24) throw new Error("ADMIN_ENCRYPTION_KEY must be configured with at least 24 characters.");
  return crypto.createHash("sha256").update(raw).digest();
}

function encrypt(value:string){
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",encryptionKey(),iv);
  const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return [iv.toString("base64"),tag.toString("base64"),encrypted.toString("base64")].join(".");
}

function decrypt(payload:string){
  const [ivRaw,tagRaw,dataRaw]=payload.split(".");
  if(!ivRaw||!tagRaw||!dataRaw) return "";
  const decipher=crypto.createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(ivRaw,"base64"));
  decipher.setAuthTag(Buffer.from(tagRaw,"base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw,"base64")),decipher.final()]).toString("utf8");
}

export async function getAdminSetting<T>(key:string,fallback:T):Promise<T>{
  await ensureSettingsSchema();
  const result=await db().query("SELECT value FROM admin_settings WHERE key=$1 AND is_secret=false",[key]);
  return result.rows[0]?.value===undefined?fallback:result.rows[0].value as T;
}

export async function setAdminSetting(key:string,value:unknown,userId?:string,description?:string){
  await ensureSettingsSchema();
  await db().query(
    `INSERT INTO admin_settings (key,value,encrypted_value,is_secret,description,updated_by,updated_at)
     VALUES ($1,$2::jsonb,NULL,false,$3,$4,now())
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,encrypted_value=NULL,is_secret=false,description=EXCLUDED.description,updated_by=EXCLUDED.updated_by,updated_at=now()`,
    [key,JSON.stringify(value),description||null,userId||null]
  );
}

export async function getAdminSecret(key:string,envFallback?:string){
  await ensureSettingsSchema();
  const result=await db().query("SELECT encrypted_value FROM admin_settings WHERE key=$1 AND is_secret=true",[key]);
  const payload=result.rows[0]?.encrypted_value;
  if(payload) return decrypt(String(payload));
  return envFallback||"";
}

export async function setAdminSecret(key:string,value:string,userId?:string,description?:string){
  await ensureSettingsSchema();
  if(!value) return;
  await db().query(
    `INSERT INTO admin_settings (key,value,encrypted_value,is_secret,description,updated_by,updated_at)
     VALUES ($1,NULL,$2,true,$3,$4,now())
     ON CONFLICT (key) DO UPDATE SET value=NULL,encrypted_value=EXCLUDED.encrypted_value,is_secret=true,description=EXCLUDED.description,updated_by=EXCLUDED.updated_by,updated_at=now()`,
    [key,encrypt(value),description||null,userId||null]
  );
}

export async function clearAdminSecret(key:string,userId?:string){
  await ensureSettingsSchema();
  await db().query("DELETE FROM admin_settings WHERE key=$1 AND is_secret=true",[key]);
}

export async function secretStatus(keys:string[]){
  await ensureSettingsSchema();
  const result=await db().query("SELECT key FROM admin_settings WHERE is_secret=true AND encrypted_value IS NOT NULL AND key=ANY($1::text[])",[keys]);
  const stored=new Set(result.rows.map((row)=>String(row.key)));
  return Object.fromEntries(keys.map((key)=>[key,stored.has(key)]));
}

export async function listAdminSettings(){
  await ensureSettingsSchema();
  const result=await db().query(
    "SELECT key,value,is_secret,(encrypted_value IS NOT NULL) AS configured,description,updated_at FROM admin_settings ORDER BY key"
  );
  return result.rows;
}
