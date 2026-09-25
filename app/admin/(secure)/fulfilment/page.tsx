import { getRuntimeCommerceSettings } from "@/lib/runtimeConfig";
import { deliveryZones } from "@/lib/fulfilment";
import { AdminFulfilmentClient } from "@/components/admin/AdminFulfilmentClient";

export const dynamic="force-dynamic";

export default async function AdminFulfilmentPage(){
  const runtime=await getRuntimeCommerceSettings();
  const zones=await deliveryZones();
  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Operations</div><h1>Delivery & collection</h1><p>Control availability, postcode coverage, charges, minimums and capacity.</p></div></header>
    <AdminFulfilmentClient initial={{...runtime,deliveryZones:zones}}/>
  </div>;
}
