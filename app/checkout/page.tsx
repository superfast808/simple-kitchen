import { CheckoutClient } from "@/components/CheckoutClient";
import { PageHero } from "@/components/PageHero";
import { getCustomerSession } from "@/lib/customerAuth";
import { getHeroConfig } from "@/lib/pageContent";

export const dynamic="force-dynamic";

export default async function CheckoutPage(){
  const [customer,hero]=await Promise.all([getCustomerSession(),getHeroConfig("checkout")]);
  return <><PageHero hero={hero}/><section className="section shell"><CheckoutClient initialCustomer={customer?{name:[customer.firstName,customer.lastName].filter(Boolean).join(" "),email:customer.email,phone:customer.phone}:undefined}/></section></>;
}
