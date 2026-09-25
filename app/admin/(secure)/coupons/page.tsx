import { AdminCouponsClient } from "@/components/admin/AdminCouponsClient";
import { listCoupons } from "@/lib/coupons";
import { products } from "@/lib/catalog";

export const dynamic="force-dynamic";

export default async function AdminCouponsPage(){
  const coupons=await listCoupons().catch(()=>[]);
  const productOptions=products.map((product)=>({id:product.id,name:product.name}));
  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Promotions & stored value</div><h1>Coupons & gift cards</h1><p>Import WooCommerce codes, manage discounts and monitor e-gift-card balances and redemptions.</p></div></header>
    <AdminCouponsClient initialRows={coupons as any} products={productOptions}/>
  </div>;
}
