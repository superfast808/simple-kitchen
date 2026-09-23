import Link from "next/link";
import { site } from "@/lib/site";

export default function HomePage() {
  return <>
    <section className="hero" style={{ backgroundImage: `url("${site.heroBackground}")` }}>
      <div className="shell hero-grid">
        <div className="hero-copy">
          <div className="eyebrow">Freshly prepared every week</div>
          <img className="hero-wordmark" src={site.heroWordmark} alt="Meals made simple by Simple Kitchen"/>
          <p>Chef prepared meals delivered weekly. Proper food, full of flavour, ready when you are.</p>
          <div className="hero-actions"><Link className="btn" href="/order">Order Now</Link><Link className="btn btn-ghost" href="/order">Browse Menu</Link></div>
        </div>
        <div className="hero-photo-card"><img src={site.prepPhoto} alt="Simple Kitchen freshly prepared meals"/></div>
      </div>
    </section>
    <section className="section shell intro-grid">
      <div><div className="eyebrow">Welcome to</div><h1>simple kitchen</h1></div>
      <div className="large-copy"><p>At Simple Kitchen, we believe eating well shouldn’t be complicated. That’s why we prepare fresh, flavour-packed meals designed to fit around your lifestyle.</p><p>Whether you’re balancing work, family, training, or just looking to save time in the kitchen, our meals give you the freedom to enjoy quality food without the hassle.</p><Link className="text-link" href="/order">View our Menu →</Link></div>
    </section>
    <section className="section section-soft"><div className="shell">
      <div className="section-heading"><div className="eyebrow">Simple by design</div><h2>How to enjoy our food</h2><p>Add the meals you want, head to checkout, then choose collection or delivery where available.</p></div>
      <div className="feature-grid">
        <Link href="/order" className="feature-card"><span>01</span><h3>Have a look at our Menu</h3><p>Our menu changes with the weekly cycle, making it easy to choose the meals you love most.</p><b>Browse this week →</b></Link>
        <Link href="/subscriptions" className="feature-card"><span>02</span><h3>Subscribe to Weekly Meals</h3><p>Make Simple Kitchen a regular thing with an automatic weekly meal subscription.</p><b>See subscriptions →</b></Link>
        <Link href="/order" className="feature-card"><span>03</span><h3>Simple Kitchen extras</h3><p>Breakfasts, soups, treats and chef-created specials sit alongside the main weekly menu.</p><b>See what’s available →</b></Link>
      </div>
    </div></section>
    <section className="section shell split-callout"><img src={site.prepPhoto} alt="Prepared Simple Kitchen meals"/><div><div className="eyebrow">Fresh. Convenient. Proper food.</div><h2>Made for real life</h2><p>From family dinners and busy workdays to training and everything in between, Simple Kitchen takes the prep out of eating well.</p><Link href="/story" className="btn">Our Story</Link></div></section>
  </>;
}
