import Link from "next/link";
import type { HeroConfig } from "@/lib/pageContent";

export function PageHero({hero,home=false}:{hero:HeroConfig;home?:boolean}){
  const style=hero.background?{
    backgroundImage:`linear-gradient(rgba(22,31,18,${hero.overlay}),rgba(22,31,18,${hero.overlay})),url("${hero.background}")`,
    backgroundPosition:hero.position||"center center"
  }:undefined;

  if(home) return <section className={hero.background?"hero hero-editable has-image":"hero hero-editable"} style={style}>
    <div className="shell hero-content-only">
      <div className="hero-copy">
        {hero.eyebrow&&<div className="eyebrow">{hero.eyebrow}</div>}
        <h1 className="editable-hero-title">{hero.title}</h1>
        {hero.copy&&<p>{hero.copy}</p>}
        {(hero.primaryLabel||hero.secondaryLabel)&&<div className="hero-actions">
          {hero.primaryLabel&&hero.primaryHref&&<Link className="btn" href={hero.primaryHref}>{hero.primaryLabel}</Link>}
          {hero.secondaryLabel&&hero.secondaryHref&&<Link className="btn btn-ghost" href={hero.secondaryHref}>{hero.secondaryLabel}</Link>}
        </div>}
      </div>
    </div>
  </section>;

  return <section className={hero.background?"page-hero editable-page-hero has-image":"page-hero editable-page-hero"} style={style}>
    <div className="shell narrow">
      {hero.eyebrow&&<div className="eyebrow">{hero.eyebrow}</div>}
      <h1>{hero.title}</h1>
      {hero.copy&&<p>{hero.copy}</p>}
    </div>
  </section>;
}
