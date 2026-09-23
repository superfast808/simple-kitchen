export type ProductCategory = "main" | "breakfast" | "soup" | "treat" | "special" | "gift";

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  weeks: number[] | "always";
  image?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  allergens?: string[];
  featured?: boolean;
};

export type CartItem = { product: Product; quantity: number };
export type Fulfilment = "collection" | "delivery";
