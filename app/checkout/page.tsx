import { CheckoutClient } from "@/components/CheckoutClient";
import { getCustomerSession } from "@/lib/customerAuth";

export const dynamic="force-dynamic";

export default async function CheckoutPage(){
  const customer=await getCustomerSession();
  return <><section className="page-hero"><div className="shell narrow"><div className="eyebrow">Secure checkout</div><h1>Checkout</h1></div></section><section className="section shell"><CheckoutClient initialCustomer={customer?{name:[customer.firstName,customer.lastName].filter(Boolean).join(" "),email:customer.email,phone:customer.phone}:undefined}/></section></>;
}
