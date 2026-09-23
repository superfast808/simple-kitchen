import Link from "next/link";
export default function AccountPage() {
  return <section className="section shell narrow account-card"><div className="eyebrow">Customer account</div><h1>Your Simple Kitchen account</h1><p>The replacement storefront is structured to carry customer and subscription history across cleanly. Existing subscriptions continue to be serviced through the current payment records during migration.</p><div className="account-actions"><Link className="btn" href="/subscriptions">Manage subscriptions</Link><a className="btn btn-ghost" href="mailto:simplekitchenprep@gmail.com">Contact Simple Kitchen</a></div></section>;
}
