import { NextRequest,NextResponse } from "next/server";
import { auditAdmin,requestIp,requireAdminApi,sameOriginMutation } from "@/lib/adminAuth";
import { setAdminSetting } from "@/lib/adminSettings";

function int(value:unknown,min:number,max:number,label:string){
  const parsed=Number(value);
  if(!Number.isInteger(parsed)||parsed<min||parsed>max) throw new Error(label+" is invalid.");
  return parsed;
}

export async function POST(request:NextRequest){
  if(!sameOriginMutation(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const session=await requireAdminApi(["owner","admin","operator"]);
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const cycleStartDate=String(body.cycleStartDate||"");
    const force=String(body.menuForceState||"auto");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(cycleStartDate)) throw new Error("Week 1 anchor date is invalid.");
    if(!["auto","open","closed"].includes(force)) throw new Error("Ordering state is invalid.");
    const values={
      menuOpenDay:int(body.menuOpenDay,1,7,"Opening day"),
      menuOpenHour:int(body.menuOpenHour,0,23,"Opening hour"),
      menuOpenMinute:int(body.menuOpenMinute,0,59,"Opening minute"),
      menuCloseDay:int(body.menuCloseDay,1,7,"Closing day"),
      menuCloseHour:int(body.menuCloseHour,0,23,"Closing hour"),
      menuCloseMinute:int(body.menuCloseMinute,0,59,"Closing minute"),
      fulfilmentOffsetDays:int(body.fulfilmentOffsetDays,0,21,"Fulfilment offset")
    };
    await Promise.all([
      setAdminSetting("cycle_start_date",cycleStartDate,session.userId),
      setAdminSetting("menu_force_state",force,session.userId),
      setAdminSetting("menu_open_day",values.menuOpenDay,session.userId),
      setAdminSetting("menu_open_hour",values.menuOpenHour,session.userId),
      setAdminSetting("menu_open_minute",values.menuOpenMinute,session.userId),
      setAdminSetting("menu_close_day",values.menuCloseDay,session.userId),
      setAdminSetting("menu_close_hour",values.menuCloseHour,session.userId),
      setAdminSetting("menu_close_minute",values.menuCloseMinute,session.userId),
      setAdminSetting("fulfilment_offset_days",values.fulfilmentOffsetDays,session.userId)
    ]);
    await auditAdmin({userId:session.userId,actorEmail:session.email,action:"weeks.schedule_update",entityType:"settings",detail:{cycleStartDate,force,...values},ipAddress:requestIp(request)});
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to save week schedule."},{status:400});
  }
}
