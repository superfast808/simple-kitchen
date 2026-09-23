import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { sendMail } from "@/lib/mail";
import { activeSubscriptionLinks } from "@/lib/subscriptions";

export async function POST(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  }
  const rows = await activeSubscriptionLinks();
  let sent = 0;
  for (const row of rows) {
    const url = `${config.siteUrl}/subscription-select?token=${row.selection_token}`;
    const ok = await sendMail(row.customer_email, "Choose this week's Simple Kitchen meals", `<h2>This week's menu is live</h2><p><a href="${url}">Choose your meals</a></p>`);
    if (ok) sent++;
  }
  return NextResponse.json({ subscriptions:rows.length, sent });
}
