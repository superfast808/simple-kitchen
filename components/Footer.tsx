import Link from "next/link";
import { site } from "@/lib/site";
export function Footer() {
  return <footer className="footer">
    <div className="footer-grid shell">
      <div><img className="footer-logo" src={site.logo} alt="Simple Kitchen"/><p>Chef-prepared meals made simple.</p></div>
      <div><h3>Simple Kitchen Prep</h3>{site.address.map((line) => <div key={line}>{line}</div>)}</div>
      <div><h3>Explore</h3><Link href="/order">Order Here</Link><Link href="/subscriptions">Subscriptions</Link><Link href="/story">Our Story</Link><Link href="/find-us">Where to find us</Link></div>
      <div><h3>Contact</h3><a href={`mailto:${site.email}`}>{site.email}</a><a href={site.instagram} target="_blank" rel="noreferrer">@simplekitchenprep</a></div>
    </div>
    <div className="footer-bottom shell"><span>© {new Date().getFullYear()} Simple Kitchen Prep</span><span><Link href="/privacy">Privacy Policy</Link> · E-Commerce Solution by IT Expert Ayrshire</span></div>
  </footer>;
}
