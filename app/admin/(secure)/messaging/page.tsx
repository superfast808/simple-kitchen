import { requireAdmin } from "@/lib/adminAuth";
import { getAdminSecret,getAdminSetting } from "@/lib/adminSettings";
import { reminderCandidates,runSmsReminders } from "@/lib/smsReminders";
import { AdminMessagingClient } from "@/components/admin/AdminMessagingClient";

export const dynamic="force-dynamic";

export default async function AdminMessagingPage(){
  const session=await requireAdmin();
  const preview=await runSmsReminders({dryRun:true}).catch(()=>({candidates:[]} as any));
  const [
    smsEnabled,smsLookbackDays,smsMessage,smsDay,smsHour,smsMinute,
    clicksendUsername,clicksendFrom,clicksendApiKey,
    smtpHost,smtpPort,smtpSecure,smtpUser,smtpFrom,smtpPass
  ]=await Promise.all([
    getAdminSetting("sms_enabled",process.env.SMS_REMINDERS_ENABLED==="true"),
    getAdminSetting("sms_lookback_days",Number(process.env.SMS_REMINDER_LOOKBACK_DAYS||90)),
    getAdminSetting("sms_message",process.env.SMS_REMINDER_MESSAGE||"Hi {first_name}, this week's Simple Kitchen menu is live. Order at {shop_url}"),
    getAdminSetting("sms_day",Number(process.env.SMS_AUTO_DAY||1)),
    getAdminSetting("sms_hour",Number(process.env.SMS_AUTO_HOUR||10)),
    getAdminSetting("sms_minute",Number(process.env.SMS_AUTO_MINUTE||0)),
    getAdminSetting("clicksend_username",process.env.CLICKSEND_USERNAME||""),
    getAdminSetting("clicksend_from",process.env.CLICKSEND_FROM||""),
    getAdminSecret("clicksend_api_key",process.env.CLICKSEND_API_KEY||""),
    getAdminSetting("smtp_host",process.env.SMTP_HOST||""),
    getAdminSetting("smtp_port",Number(process.env.SMTP_PORT||587)),
    getAdminSetting("smtp_secure",process.env.SMTP_SECURE==="true"),
    getAdminSetting("smtp_user",process.env.SMTP_USER||""),
    getAdminSetting("smtp_from",process.env.SMTP_FROM||"Simple Kitchen <simplekitchenprep@gmail.com>"),
    getAdminSecret("smtp_pass",process.env.SMTP_PASS||"")
  ]);

  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Customer communications</div><h1>Messaging</h1><p>SMS reminders, SMTP delivery, audience preview and manual controls.</p></div></header>
    <AdminMessagingClient adminEmail={session.email} initial={{
      smsEnabled:Boolean(smsEnabled),smsLookbackDays:Number(smsLookbackDays),smsMessage:String(smsMessage),
      smsDay:Number(smsDay),smsHour:Number(smsHour),smsMinute:Number(smsMinute),
      clicksendUsername:String(clicksendUsername),clicksendFrom:String(clicksendFrom),clicksendConfigured:Boolean(clicksendUsername&&clicksendApiKey),
      smtpHost:String(smtpHost),smtpPort:Number(smtpPort),smtpSecure:Boolean(smtpSecure),smtpUser:String(smtpUser),smtpFrom:String(smtpFrom),smtpConfigured:Boolean(smtpHost&&smtpUser&&smtpPass),
      candidates:(preview as any).candidates||[]
    }}/>
  </div>;
}
