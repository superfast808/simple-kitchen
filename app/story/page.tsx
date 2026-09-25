import { site } from "@/lib/site";
import { PageHero } from "@/components/PageHero";
import { getHeroConfig } from "@/lib/pageContent";

export const dynamic="force-dynamic";

export default async function StoryPage() {
  const hero=await getHeroConfig("story");
  return <><PageHero hero={hero}/><section className="section shell story-grid"><img src={site.prepPhoto} alt="Simple Kitchen meals being prepared"/><div className="large-copy"><p>Simple Kitchen is a family run business. The idea became a reality when our little boy Edson was born. The same month, we decided to launch our meal prep company and watch our vision turn into a reality.</p><p>Simon, known as Si, is our chef and dad to Edson. With 10 years’ experience cheffing in the army, he’s not shy of feeding a large amount of people in one go.</p><p>Katy is behind the scenes at Simple Kitchen alongside being full-time mum to Edson. Everything and anything you can think of that happens at Simple Kitchen — Katy does it.</p><p>Our aim is to provide premium meal preps for everyone: family dinners, work lunches, busy parents, gym-goers, or simply anyone who wants to save the hassle of shopping and cooking.</p></div></section></>;
}
