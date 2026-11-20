// "Customer of the Year" export, carried over from the SK Rewards plugin.
// Paid orders grouped by email (guest checkouts included), excluding automatic
// subscription renewals, with recorded refunds subtracted.

import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import { ensureBridgeSchema } from "@/lib/kitchenBridge";

export const dynamic="force-dynamic";

function csvCell(value:unknown){
  const text=value==null?"":String(value);
  // Guard against spreadsheet formula injection from customer-entered names.
  const safe=/^[=+\-@\t\r]/.test(text)?"'"+text:text;
  return /[",\n\r]/.test(safe)?'"'+safe.replace(/"/g,'""')+'"':safe;
}

export async function GET(request:NextRequest){
  const session=await requireAdminApi(["owner","admin"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  await ensureBridgeSchema();
  const result=await db().query(`
    WITH paid AS (
      SELECT o.id,o.created_at,o.total_pence,
        lower(trim(COALESCE(NULLIF(o.billing_address->>'email',''),o.customer->>'email'))) AS email,
        COALESCE(NULLIF(trim(concat_ws(' ',o.billing_address->>'first_name',o.billing_address->>'last_name')),''),o.customer->>'name') AS name,
        COALESCE((SELECT SUM(r.amount_pence) FROM order_refunds r WHERE r.order_id=o.id),0)
          + COALESCE((SELECT SUM(abs((x->>'total')::numeric)*100) FROM jsonb_array_elements(COALESCE(o.source_meta->'refunds','[]'::jsonb)) x),0) AS refunded_pence
      FROM orders o
      WHERE o.status IN ('paid','processing','completed')
        AND COALESCE(o.source_meta->>'created_via','')<>'subscription'
    )
    SELECT email,
      (array_agg(name ORDER BY created_at DESC) FILTER (WHERE name IS NOT NULL AND name<>''))[1] AS name,
      COUNT(*)::int AS paid_orders,
      GREATEST(0,SUM(total_pence-refunded_pence))::bigint AS lifetime_pence,
      MIN(created_at) AS first_order,
      MAX(created_at) AS latest_order,
      COUNT(DISTINCT to_char(created_at AT TIME ZONE 'Europe/London','YYYY-MM'))::int AS months_ordered
    FROM paid
    WHERE email IS NOT NULL AND email<>''
    GROUP BY email
    ORDER BY lifetime_pence DESC,paid_orders DESC
  `);
  const header=["Email","Name","Paid orders","Lifetime paid (£)","First order","Latest order","Months ordered"];
  const day=(value:Date)=>new Date(value).toLocaleDateString("en-CA",{timeZone:"Europe/London"});
  const lines=[header.map(csvCell).join(",")];
  for(const row of result.rows){
    lines.push([
      row.email,row.name||"",row.paid_orders,(Number(row.lifetime_pence)/100).toFixed(2),
      day(row.first_order),day(row.latest_order),row.months_ordered
    ].map(csvCell).join(","));
  }
  await auditAdmin({userId:session.userId,actorEmail:session.email,action:"report.customer_of_year",entityType:"report",detail:{rows:result.rows.length},ipAddress:requestIp(request)});
  const stamp=new Date().toISOString().slice(0,10);
  return new NextResponse(lines.join("\r\n")+"\r\n",{
    headers:{
      "content-type":"text/csv; charset=utf-8",
      "content-disposition":'attachment; filename="simple-kitchen-customers-'+stamp+'.csv"',
      "cache-control":"no-store"
    }
  });
}
