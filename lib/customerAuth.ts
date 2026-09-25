import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE_NAME="sk_customer_session";
let schemaReady:Promise<void>|null=null;

export type CustomerSession={
  id:string;
  userId:string;
  email:string;
  firstName:string;
  lastName:string;
  phone:string;
};

export async function ensureCustomerSchema(){
  if(!schemaReady){
    schemaReady=db().query(`
      CREATE TABLE IF NOT EXISTS customer_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL,
        first_name text NOT NULL DEFAULT '',
        last_name text NOT NULL DEFAULT '',
        phone text,
        password_hash text NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        email_verified boolean NOT NULL DEFAULT false,
        last_login_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS customer_users_email_unique_idx ON customer_users (lower(email));
      CREATE TABLE IF NOT EXISTS customer_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES customer_users(id) ON DELETE CASCADE,
        token_hash text UNIQUE NOT NULL,
        ip_address text,
        user_agent text,
        expires_at timestamptz NOT NULL,
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS customer_login_attempts (
        id bigserial PRIMARY KEY,
        email text,
        ip_address text,
        success boolean NOT NULL DEFAULT false,
        attempted_at timestamptz NOT NULL DEFAULT now()
      );
    `).then(()=>undefined);
  }
  await schemaReady;
}

function tokenHash(token:string){
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashPassword(password:string){
  if(password.length<12) throw new Error("Password must be at least 12 characters.");
  const salt=crypto.randomBytes(16).toString("hex");
  return "scrypt$"+salt+"$"+crypto.scryptSync(password,salt,64).toString("hex");
}

function verifyPassword(password:string,stored:string){
  const [kind,salt,expected]=stored.split("$");
  if(kind!=="scrypt"||!salt||!expected) return false;
  const actual=crypto.scryptSync(password,salt,64);
  const target=Buffer.from(expected,"hex");
  return actual.length===target.length&&crypto.timingSafeEqual(actual,target);
}

async function createSession(user:any,ip:string,userAgent:string){
  const token=crypto.randomBytes(32).toString("base64url");
  const days=Math.min(90,Math.max(1,Number(process.env.CUSTOMER_SESSION_DAYS||30)));
  const result=await db().query(
    `INSERT INTO customer_sessions (user_id,token_hash,ip_address,user_agent,expires_at)
     VALUES ($1,$2,$3,$4,now()+($5||' days')::interval)
     RETURNING id,expires_at`,
    [user.id,tokenHash(token),ip,userAgent,String(days)]
  );
  const store=await cookies();
  store.set(COOKIE_NAME,token,{
    httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",
    expires:new Date(result.rows[0].expires_at)
  });
}

export async function registerCustomer(input:{email:string;password:string;firstName:string;lastName:string;phone?:string;ip?:string;userAgent?:string}){
  await ensureCustomerSchema();
  const email=input.email.trim().toLowerCase();
  if(!email||!email.includes("@")) throw new Error("Enter a valid email address.");
  if(!input.firstName.trim()) throw new Error("First name is required.");
  const passwordHash=hashPassword(input.password);
  try{
    const result=await db().query(
      `INSERT INTO customer_users (email,first_name,last_name,phone,password_hash)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id,email,first_name,last_name,phone`,
      [email,input.firstName.trim(),input.lastName.trim(),input.phone?.trim()||null,passwordHash]
    );
    const user=result.rows[0];
    await createSession(user,input.ip||"",input.userAgent||"");
    return user;
  }catch(error){
    const message=error instanceof Error?error.message:"Unable to create account.";
    if(message.includes("duplicate key")) throw new Error("An account already exists for this email address.");
    throw error;
  }
}

export async function loginCustomer(input:{email:string;password:string;ip?:string;userAgent?:string}){
  await ensureCustomerSchema();
  const email=input.email.trim().toLowerCase();
  const ip=input.ip||"";
  const attempts=await db().query(
    `SELECT COUNT(*)::int AS count FROM customer_login_attempts
     WHERE success=false AND attempted_at>now()-interval '15 minutes'
       AND (lower(email)=lower($1) OR ($2<>'' AND ip_address=$2))`,
    [email,ip]
  );
  if(Number(attempts.rows[0]?.count||0)>=10) throw new Error("Too many login attempts. Try again later.");

  const result=await db().query(
    "SELECT id,email,first_name,last_name,phone,password_hash,enabled FROM customer_users WHERE lower(email)=lower($1) LIMIT 1",
    [email]
  );
  const user=result.rows[0];
  const valid=Boolean(user?.enabled&&verifyPassword(input.password,String(user.password_hash||"")));
  await db().query("INSERT INTO customer_login_attempts (email,ip_address,success) VALUES ($1,$2,$3)",[email,ip,valid]);
  if(!valid) throw new Error("Email or password is incorrect.");

  await createSession(user,ip,input.userAgent||"");
  await db().query("UPDATE customer_users SET last_login_at=now(),updated_at=now() WHERE id=$1",[user.id]);
  return user;
}

export async function getCustomerSession():Promise<CustomerSession|null>{
  await ensureCustomerSchema();
  const store=await cookies();
  const token=store.get(COOKIE_NAME)?.value;
  if(!token) return null;
  const result=await db().query(
    `SELECT s.id,u.id AS user_id,u.email,u.first_name,u.last_name,u.phone
     FROM customer_sessions s JOIN customer_users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at>now() AND u.enabled=true LIMIT 1`,
    [tokenHash(token)]
  );
  const row=result.rows[0];
  if(!row) return null;
  await db().query("UPDATE customer_sessions SET last_seen_at=now() WHERE id=$1",[row.id]).catch(()=>undefined);
  return {
    id:String(row.id),userId:String(row.user_id),email:String(row.email),
    firstName:String(row.first_name||""),lastName:String(row.last_name||""),phone:String(row.phone||"")
  };
}

export async function logoutCustomer(){
  const store=await cookies();
  const token=store.get(COOKIE_NAME)?.value;
  if(token){
    await ensureCustomerSchema();
    await db().query("DELETE FROM customer_sessions WHERE token_hash=$1",[tokenHash(token)]).catch(()=>undefined);
  }
  store.set(COOKIE_NAME,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});
}
