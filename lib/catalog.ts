import type { Product } from "./types";

export const products: Product[] = [
  { id:"5084", name:"Orange Drizzle Cake", description:"Chef-prepared Simple Kitchen treat.", price:4, category:"treat", weeks:[1], image:"https://simplekitchenprep.com/wp-content/uploads/2025/06/WhatsApp-Image-2026-04-04-at-12.45.38.jpeg" },
  { id:"1768", name:"White Chocolate Oreo Oats", description:"Chef-prepared overnight oats.", price:4.25, category:"breakfast", weeks:[1], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51-1.jpeg" },
  { id:"1767", name:"Beef & Chilli Sausage Gochujang Rigatoni", description:"Chef-prepared Simple Kitchen meal.", price:7.75, category:"main", weeks:[1], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51.jpeg" },
  { id:"1765", name:"Cantonese Sweet Chilli Chicken Noodles", description:"Chef-prepared Simple Kitchen meal.", price:7.75, category:"main", weeks:[1], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51.jpeg" },
  { id:"1762", name:"SK Special - Butter Halloumi Curry", description:"Chef-created SK Special.", price:9.75, category:"special", weeks:[1], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51.jpeg", featured:true },
  { id:"1682", name:"Milk Chocolate Biscoff Oats", description:"Chef-prepared overnight oats.", price:4.25, category:"breakfast", weeks:[1], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51-1.jpeg" },
  { id:"654", name:"Cajun Pulled Beef Pasta", description:"Chef-prepared Simple Kitchen meal.", price:7.75, category:"main", weeks:[1], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51.jpeg" },
  { id:"652", name:"Carrot & Parsnip Soup", description:"Fresh chef-prepared soup.", price:4.25, category:"soup", weeks:[1], image:"https://simplekitchenprep.com/wp-content/uploads/2025/06/WhatsApp-Image-2026-04-04-at-12.45.38.jpeg" },
  { id:"646", name:"Pulled Chipotle Chicken Thigh with Rice", description:"Chef-prepared Simple Kitchen meal.", price:7.75, category:"main", weeks:[1], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51.jpeg" },
  { id:"642", name:"Caramelised Coconut Chicken Thigh & Rice", description:"Chef-prepared Simple Kitchen meal.", price:7.75, category:"main", weeks:[1], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51.jpeg" },
  { id:"636", name:"Prawn & Chorizo Linguine", description:"Chef-created SK Special.", price:9.75, category:"special", weeks:[1], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51.jpeg", featured:true },

  { id:"1764", name:"Roasted Vegetable Soup", description:"Fresh chef-prepared soup.", price:4.25, category:"soup", weeks:[2], image:"https://simplekitchenprep.com/wp-content/uploads/2025/06/WhatsApp-Image-2026-04-04-at-12.45.38.jpeg" },
  { id:"1630", name:"Milk Chocolate Ginger Biscuit Oats", description:"354 Cals · 12g Protein · 51g Carbs · 11g Fat", price:4.25, category:"breakfast", weeks:[2], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51-1.jpeg", calories:354, protein:12, carbs:51, fat:11, allergens:["Milk","Gluten"] },
  { id:"1576", name:"Peanut Butter & White Chocolate Oats", description:"334 Cals · 17g Protein · 40g Carbs · 16g Fat", price:4.25, category:"breakfast", weeks:[2], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51-1.jpeg", calories:334, protein:17, carbs:40, fat:16, allergens:["Milk","Gluten","Soy","Peanuts"] },
  { id:"1552", name:"Spaghetti Carbonara", description:"SK Special — a chef-created meal with larger portions, complete comfort & no tracking required.", price:9.75, category:"special", weeks:[2], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51.jpeg", featured:true },
  { id:"1503", name:"Gingerbread Loaf", description:"248 Cals · 3g Protein · 38g Carbs · 10g Fat", price:4, category:"treat", weeks:[2], image:"https://simplekitchenprep.com/wp-content/uploads/2025/06/WhatsApp-Image-2026-04-04-at-12.45.38.jpeg", calories:248, protein:3, carbs:38, fat:10, allergens:["Milk","Gluten","Egg"] },
  { id:"656", name:"Thai Salmon Noodles", description:"694 Cals · 41g Protein · 60g Carbs · 30g Fat", price:9.75, category:"special", weeks:[2], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51.jpeg", calories:694, protein:41, carbs:60, fat:30, allergens:["Fish","Gluten","Crustaceans","Soybeans"], featured:true },
  { id:"648", name:"Kung Pao Chicken & Rice", description:"610 Cals · 48g Protein · 77g Carbs · 11g Fat", price:7.75, category:"main", weeks:[2], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51.jpeg", calories:610, protein:48, carbs:77, fat:11, allergens:["Gluten","Soy","Sesame"] },
  { id:"647", name:"Honey Sriracha Chicken & Rice", description:"586 Cals · 48g Protein · 88g Carbs · 4g Fat", price:7.75, category:"main", weeks:[2], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51.jpeg", calories:586, protein:48, carbs:88, fat:4, allergens:["Sulphites","Celery","Gluten","Soy"] },
  { id:"645", name:"Beef & Nduja Mac n Cheese", description:"663 Cals · 48g Protein · 63g Carbs · 22g Fat", price:7.75, category:"main", weeks:[2], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51.jpeg", calories:663, protein:48, carbs:63, fat:22, allergens:["Wheat","Gluten","Milk"] },
  { id:"639", name:"Spanish Style Chicken Pasta", description:"624 Cals · 43g Protein · 60g Carbs · 21g Fat", price:7.75, category:"main", weeks:[2], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51.jpeg", calories:624, protein:43, carbs:60, fat:21, allergens:["Gluten","Milk"] },
  { id:"637", name:"Slow Cooked Beef Massaman Noodles", description:"663 Cals · 46g Protein · 67g Carbs · 24g Fat", price:7.75, category:"main", weeks:[2], image:"https://simplekitchenprep.com/wp-content/uploads/2025/08/WhatsApp-Image-2026-04-04-at-12.38.51.jpeg", calories:663, protein:46, carbs:67, fat:24, allergens:["Gluten","Peanuts","Fish","Soy"] },

  { id:"358", name:"Simple Kitchen Gift Card", description:"Treat someone with a Simple Kitchen Gift Card.", price:20, priceOptions:[20,30,40,50,60,70,80,90,100], category:"gift", weeks:"always", image:"https://simplekitchenprep.com/wp-content/uploads/revslider/slider-1/heropng2.png" }
];

const expandedProducts=products.flatMap((product)=>
  product.priceOptions?.length
    ? product.priceOptions.map((price)=>({ ...product, id:product.id+"-"+price, price, priceOptions:undefined }))
    : [product]
);

export const productById=new Map(expandedProducts.map((product)=>[product.id,product]));

export function productsForWeek(week:number,menuOpen:boolean) {
  return products.filter((product)=>product.weeks==="always"||(menuOpen&&product.weeks.includes(week)));
}
