import { site } from "./site";
import type { Product } from "./types";

const legacy = (id: string, name: string, week: number): Product => ({
  id, name,
  description: "Chef-prepared Simple Kitchen meal.",
  price: 7.5,
  category: "main",
  weeks: [week],
  image: site.prepPhoto
});

export const products: Product[] = [
  legacy("w1-chilli-rice", "Chilli with Rice", 1),
  legacy("w1-cajun-chicken-pasta", "Cajun Chicken Pasta", 1),
  legacy("w1-lemon-herb-orzo", "Creamy Lemon & Herb Chicken with Orzo", 1),
  legacy("w1-honey-sesame", "Honey Sesame Chicken with Rice", 1),
  legacy("w1-jerk-chicken", "Jerk Chicken with Sweet Potato + Veg", 1),

  { id:"roasted-vegetable-soup", name:"Roasted Vegetable Soup", description:"Fresh chef-prepared soup.", price:4.25, category:"soup", weeks:[2], image:site.prepPhoto },
  { id:"milk-choc-ginger-oats", name:"Milk Chocolate Ginger Biscuit Oats", description:"354 Cals · 12g Protein · 51g Carbs · 11g Fat", price:4.25, category:"breakfast", weeks:[2], image:site.prepPhoto, calories:354, protein:12, carbs:51, fat:11, allergens:["Milk","Gluten"] },
  { id:"peanut-white-choc-oats", name:"Peanut Butter & White Chocolate Oats", description:"334 Cals · 17g Protein · 40g Carbs · 16g Fat", price:4.25, category:"breakfast", weeks:[2], image:site.prepPhoto, calories:334, protein:17, carbs:40, fat:16, allergens:["Milk","Gluten","Soy","Peanuts"] },
  { id:"spaghetti-carbonara", name:"Spaghetti Carbonara", description:"SK Special — a chef-created meal with larger portions, complete comfort and no tracking required.", price:9.75, category:"special", weeks:[2], image:site.prepPhoto, featured:true },
  { id:"gingerbread-loaf", name:"Gingerbread Loaf", description:"248 Cals · 3g Protein · 38g Carbs · 10g Fat", price:4, category:"treat", weeks:[2], image:site.prepPhoto, calories:248, protein:3, carbs:38, fat:10, allergens:["Milk","Gluten","Egg"] },
  { id:"thai-salmon-noodles", name:"Thai Salmon Noodles", description:"694 Cals · 41g Protein · 60g Carbs · 30g Fat", price:9.75, category:"special", weeks:[2], image:site.prepPhoto, calories:694, protein:41, carbs:60, fat:30, allergens:["Fish","Gluten","Crustaceans","Soybeans"] },
  { id:"kung-pao-chicken-rice", name:"Kung Pao Chicken & Rice", description:"610 Cals · 48g Protein · 77g Carbs · 11g Fat", price:7.75, category:"main", weeks:[2], image:site.prepPhoto, calories:610, protein:48, carbs:77, fat:11, allergens:["Gluten","Soy","Sesame"] },
  { id:"honey-sriracha-chicken", name:"Honey Sriracha Chicken & Rice", description:"586 Cals · 48g Protein · 88g Carbs · 4g Fat", price:7.75, category:"main", weeks:[2], image:site.prepPhoto, calories:586, protein:48, carbs:88, fat:4, allergens:["Sulphites","Celery","Gluten","Soy"] },
  { id:"beef-nduja-mac", name:"Beef & Nduja Mac n Cheese", description:"663 Cals · 48g Protein · 63g Carbs · 22g Fat", price:7.75, category:"main", weeks:[2], image:site.prepPhoto, calories:663, protein:48, carbs:63, fat:22, allergens:["Wheat","Gluten","Milk"] },
  { id:"spanish-chicken-pasta", name:"Spanish Style Chicken Pasta", description:"624 Cals · 43g Protein · 60g Carbs · 21g Fat", price:7.75, category:"main", weeks:[2], image:site.prepPhoto, calories:624, protein:43, carbs:60, fat:21, allergens:["Gluten","Milk"] },
  { id:"beef-massaman-noodles", name:"Slow Cooked Beef Massaman Noodles", description:"663 Cals · 46g Protein · 67g Carbs · 24g Fat", price:7.75, category:"main", weeks:[2], image:site.prepPhoto, calories:663, protein:46, carbs:67, fat:24, allergens:["Gluten","Peanuts","Fish","Soy"] },

  legacy("w3-cajun-beef-pasta", "Cajun Beef Pasta", 3),
  legacy("w3-thai-basil-beef", "Thai Basil Beef with Rice", 3),
  legacy("w3-chicken-korma", "Chicken Korma with Rice", 3),
  legacy("w3-tomato-chicken-orzo", "Creamy Tomato Chicken Orzo", 3),
  legacy("w3-sticky-honey-garlic", "Sticky Honey Garlic & Soy Chicken with Potato & Veg", 3),

  legacy("w4-chicken-katsu", "Chicken Katsu with Rice", 4),
  legacy("w4-chipotle-beef-mac", "Chipotle Beef Mac & Cheese", 4),
  legacy("w4-sweet-chilli-beef", "Sweet Chilli Beef with Pasta", 4),
  legacy("w4-bbq-chicken", "BBQ Chicken with Sweet Potato & Veg", 4),
  legacy("w4-chicken-shawarma", "Chicken Shawarma with Roasted Veg Couscous", 4),

  legacy("w5-teriyaki-chicken", "Teriyaki Chicken with Rice", 5),
  legacy("w5-mexican-beef", "Mexican Beef with Potatoes & Veg", 5),
  legacy("w5-honey-sriracha-beef", "Honey Sriracha Beef with Rice", 5),
  legacy("w5-greek-lemon-chicken", "Greek Lemon Chicken with Couscous", 5),
  legacy("w5-peri-peri-pasta", "Peri Peri Garlic Chicken Pasta", 5),

  legacy("w6-spaghetti-bolognese", "Spaghetti Bolognese", 6),
  legacy("w6-chicken-satay", "Chicken Satay with Rice", 6),
  legacy("w6-harissa-beef-pasta", "Harissa Beef Pasta", 6),
  legacy("w6-chinese-spiced-chicken", "Chinese Spiced Chicken with Rice", 6),
  legacy("w6-garlic-herb-chicken", "Garlic and Herb Chicken with Potatoes + Veg", 6),

  { id:"gift-card", name:"Simple Kitchen Gift Card", description:"Treat someone with a Simple Kitchen Gift Card.", price:20, category:"gift", weeks:"always", image:site.logo }
];

export const productById = new Map(products.map((p) => [p.id, p]));

export function productsForWeek(week: number, menuOpen: boolean) {
  return products.filter((product) => product.weeks === "always" || (menuOpen && product.weeks.includes(week)));
}
