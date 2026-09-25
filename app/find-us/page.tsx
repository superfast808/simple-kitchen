import { PageHero } from "@/components/PageHero";
import { getHeroConfig } from "@/lib/pageContent";

export const dynamic="force-dynamic";

const stockists = [
["Base Fitness","63 Colvilles Pl, East Kilbride, G75 0PZ"],["Better Bodies","Glasgow"],["Cathcart Spar","Glasgow, G44 4EH"],["Clydebank Filling Station","Clydebank, G81 6AU"],["Commando X Fit","8 Lorne Rd, Glasgow, G52 4HG"],["Funktional Fitness","East Kilbride, G74 5BA"],["Inspire Fitness","Barrhead, G78 1SL"],["ItsPadel","East Kilbride, G75 0YA"],["Keystore Anniesland","Glasgow, G13 1ED"],["Keystore Hairmyres","East Kilbride, G75 8RH"],["Keystore Renfrew","Renfrew, PA4 0SA"],["PaperRack Newsagents","Paisley, PA1 1XU"],["Park Farm","Glasgow, G75 0QL"],["Premier Annbank","Annbank"],["Premier Paisley","Paisley"],["Spar Clarkston","Clarkston, G76 7DH"],["Racket Barn","Glasgow, G51 3HB"]
];
export default async function FindUsPage() {
  const hero=await getHeroConfig("find-us");
  return <><PageHero hero={hero}/><section className="section shell"><div className="stockist-grid">{stockists.map(([name,address]) => <article className="stockist-card" key={name}><span>SK</span><div><h3>{name}</h3><p>{address}</p></div></article>)}</div></section></>;
}
