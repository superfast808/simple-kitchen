import nodemailer from "nodemailer";
import { getAdminSecret,getAdminSetting } from "./adminSettings";

async function mailSettings(){
  const [host,port,secure,user,pass,from]=await Promise.all([
    getAdminSetting("smtp_host",process.env.SMTP_HOST||""),
    getAdminSetting("smtp_port",Number(process.env.SMTP_PORT||587)),
    getAdminSetting("smtp_secure",process.env.SMTP_SECURE==="true"),
    getAdminSetting("smtp_user",process.env.SMTP_USER||""),
    getAdminSecret("smtp_pass",process.env.SMTP_PASS||""),
    getAdminSetting("smtp_from",process.env.SMTP_FROM||"Simple Kitchen <simplekitchenprep@gmail.com>")
  ]);
  return {host:String(host),port:Number(port)||587,secure:Boolean(secure),user:String(user),pass:String(pass),from:String(from)};
}

export async function mailConfigured(){
  const settings=await mailSettings();
  return Boolean(settings.host&&settings.user&&settings.pass);
}

export async function sendMail(to:string,subject:string,html:string){
  const settings=await mailSettings();
  if(!settings.host||!settings.user||!settings.pass) return false;
  const transporter=nodemailer.createTransport({
    host:settings.host,
    port:settings.port,
    secure:settings.secure,
    auth:{user:settings.user,pass:settings.pass}
  });
  await transporter.sendMail({from:settings.from,to,subject,html});
  return true;
}
