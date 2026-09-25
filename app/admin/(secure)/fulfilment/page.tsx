import { getRuntimeCommerceSettings } from "@/lib/runtimeConfig";
import { shippingZones } from "@/lib/fulfilment";
import { AdminFulfilmentClient } from "@/components/admin/AdminFulfilmentClient";

export const dynamic="force-dynamic";

export default async function AdminFulfilmentPage(){
  const runtime=await getRuntimeCommerceSettings();
  const zones=await shippingZones();
  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Operations</div><h1>Delivery & collection</h1><p>Woo-style shipping zones, postcode coverage, methods, charges, minimums and capacity.</p></div></header>
    <AdminFulfilmentClient initial={{
      weeklyItemCap:runtime.weeklyItemCap,deliverySlotCap:runtime.deliverySlotCap,
      deliveryFeePence:runtime.deliveryFeePence,minimumOrderPence:runtime.minimumOrderPence,
      deliveryEnabled:runtime.deliveryEnabled,collectionEnabled:runtime.collectionEnabled,
      deliveryZones:zones
    }}/>
  </div>;
}
