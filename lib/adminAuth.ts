import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

const COOKIE_NAME="sk_admin_session";
let schemaReady:Promise<void>|null=null;

export type AdminRole="owner"|"admin"|"operator"|"viewer";
export type AdminSession={
  id:string;
  userId:string;
  email:string;
  displayName:string;
  role:AdminRole;
};

export async function ensureAdminSchema(){
  if(!schemaReady){
    schemaReady=(async()=>{
      await db().query(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          email text UNIQUE NOT NULL,
          display_name text NOT NULL DEFAULT 'Administrator',
          password_hash text NOT NULL,
          role text NOT NULL DEFAULT 'owner',
          enabled boolean NOT NULL DEFAULT true,
          last_login_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS admin_sessions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
          token_hash text UNIQUE NOT NULL,
          ip_address text,
          user_agent text,
          expires_at timestamptz NOT NULL,
          last_seen_at timestamptz NOT NULL DEFAULT now(),
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS admin_login_attempts (
          id bigserial PRIMARY KEY,
          email text,
          ip_address text,
          success boolean NOT NULL DEFAULT false,
          attempted_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS admin_audit_log (
          id bigserial PRIMARY KEY,
          user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
          actor_email text,
          action text NOT NULL,
          entity_type text,
          entity_id text,
          detail jsonb,
          ip_address text,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
    })();
  }
  await schemaReady;
}

function tokenHash(token:string){
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function hashAdminPassword(password:string){
  if(password.length<12) throw new Error("Admin passwords must be at least 12 characters.");
  const salt=crypto.randomBytes(16).toString("hex");
  const hash=crypto.scryptSync(password,salt,64).toString("hex");
  return "scrypt$"+salt+"$"+hash;
}

export function verifyAdminPassword(password:string,stored:string){
  const [kind,salt,expected]=stored.split("$");
  if(kind!=="scrypt"||!salt||!expected) return false;
  const actual=crypto.scryptSync(password,salt,64);
  const expectedBuffer=Buffer.from(expected,"hex");
  return actual.length===expectedBuffer.length&&crypto.timingSafeEqual(actual,expectedBuffer);
}

async function bootstrapAdmin(){
  await ensureAdminSchema();
  const count=await db().query("SELECT COUNT(*)::int AS count FROM admin_users");
  if(Number(count.rows[0]?.count||0)>0) return;
  const email=(process.env.ADMIN_BOOTSTRAP_EMAIL||"").trim().toLowerCase();
  const password=process.env.ADMIN_BOOTSTRAP_PASSWORD||"";
  if(!email||!password) return;
  await db().query(
    "INSERT INTO admin_users (email,display_name,password_hash,role) VALUES ($1,$2,$3,'owner') ON CONFLICT (email) DO NOTHING",
    [email,process.env.ADMIN_BOOTSTRAP_NAME||"Owner",hashAdminPassword(password)]
  );
}

export async function loginAdmin(input:{email:string;password:string;ip?:string;userAgent?:string}){
  await bootstrapAdmin();
  const email=input.email.trim().toLowerCase();
  const ip=input.ip||"";
  const attempts=await db().query(
    "SELECT COUNT(*)::int AS count FROM admin_login_attempts WHERE success=false AND attempted_at>now()-interval '15 minutes' AND (lower(email)=lower($1) OR ($2<>'' AND ip_address=$2))",
    [email,ip]
  );
  if(Number(attempts.rows[0]?.count||0)>=8) throw new Error("Too many login attempts. Try again later.");

  const result=await db().query(
    "SELECT id,email,display_name,password_hash,role,enabled FROM admin_users WHERE lower(email)=lower($1) LIMIT 1",
    [email]
  );
  const user=result.rows[0];
  const valid=Boolean(user?.enabled&&verifyAdminPassword(input.password,String(user.password_hash||"")));
  await db().query(
    "INSERT INTO admin_login_attempts (email,ip_address,success) VALUES ($1,$2,$3)",
    [email,ip,valid]
  );
  if(!valid) throw new Error("Email or password is incorrect.");

  const token=crypto.randomBytes(32).toString("base64url");
  const hours=Math.min(72,Math.max(1,Number.parseInt(process.env.ADMIN_SESSION_HOURS||"12",10)||12));
  const session=await db().query(
    "INSERT INTO admin_sessions (user_id,token_hash,ip_address,user_agent,expires_at) VALUES ($1,$2,$3,$4,now()+($5||' hours')::interval) RETURNING id,expires_at",
    [user.id,tokenHash(token),ip,input.userAgent||"",String(hours)]
  );
  await db().query("UPDATE admin_users SET last_login_at=now(),updated_at=now() WHERE id=$1",[user.id]);
  await auditAdmin({
    userId:String(user.id),actorEmail:String(user.email),action:"admin.login",entityType:"session",
    entityId:String(session.rows[0].id),ipAddress:ip
  });

  const store=await cookies();
  store.set(COOKIE_NAME,token,{
    httpOnly:true,
    secure:process.env.NODE_ENV==="production",
    sameSite:"strict",
    path:"/",
    expires:new Date(session.rows[0].expires_at)
  });
  return {email:String(user.email),displayName:String(user.display_name),role:user.role as AdminRole};
}

export async function getAdminSession():Promise<AdminSession|null>{
  await ensureAdminSchema();
  const store=await cookies();
  const token=store.get(COOKIE_NAME)?.value;
  if(!token) return null;
  const result=await db().query(
    `SELECT s.id,u.id AS user_id,u.email,u.display_name,u.role
     FROM admin_sessions s
     JOIN admin_users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at>now() AND u.enabled=true
     LIMIT 1`,
    [tokenHash(token)]
  );
  const row=result.rows[0];
  if(!row) return null;
  await db().query("UPDATE admin_sessions SET last_seen_at=now() WHERE id=$1",[row.id]).catch(()=>undefined);
  return {
    id:String(row.id),userId:String(row.user_id),email:String(row.email),
    displayName:String(row.display_name),role:row.role as AdminRole
  };
}

export async function requireAdmin(roles?:AdminRole[]){
  const session=await getAdminSession();
  if(!session) redirect("/admin/login");
  if(roles&&!roles.includes(session.role)) redirect("/admin?denied=1");
  return session;
}

export async function requireAdminApi(roles?:AdminRole[]){
  const session=await getAdminSession();
  if(!session) return null;
  if(roles&&!roles.includes(session.role)) return null;
  return session;
}

export async function logoutAdmin(){
  const store=await cookies();
  const token=store.get(COOKIE_NAME)?.value;
  if(token){
    await ensureAdminSchema();
    await db().query("DELETE FROM admin_sessions WHERE token_hash=$1",[tokenHash(token)]).catch(()=>undefined);
  }
  store.set(COOKIE_NAME,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});
}

export async function changeAdminPassword(userId:string,currentPassword:string,newPassword:string){
  await ensureAdminSchema();
  const result=await db().query("SELECT password_hash FROM admin_users WHERE id=$1",[userId]);
  const row=result.rows[0];
  if(!row||!verifyAdminPassword(currentPassword,String(row.password_hash))) throw new Error("Current password is incorrect.");
  await db().query("UPDATE admin_users SET password_hash=$2,updated_at=now() WHERE id=$1",[userId,hashAdminPassword(newPassword)]);
  await db().query("DELETE FROM admin_sessions WHERE user_id=$1",[userId]);
}

export async function auditAdmin(input:{
  userId?:string;actorEmail?:string;action:string;entityType?:string;entityId?:string;detail?:unknown;ipAddress?:string;
}){
  await ensureAdminSchema();
  await db().query(
    "INSERT INTO admin_audit_log (user_id,actor_email,action,entity_type,entity_id,detail,ip_address) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)",
    [input.userId||null,input.actorEmail||null,input.action,input.entityType||null,input.entityId||null,JSON.stringify(input.detail??null),input.ipAddress||null]
  );
}

export function requestIp(request:Request){
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||request.headers.get("x-real-ip")||"";
}

export function sameOriginMutation(request:Request){
  const origin=request.headers.get("origin");
  const host=request.headers.get("host");
  if(!origin||!host) return true;
  try{return new URL(origin).host===host;}catch{return false;}
}
