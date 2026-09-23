"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem, Product } from "@/lib/types";

type CartContextValue = {
  items: CartItem[]; count: number; subtotal: number;
  add: (product: Product, quantity?: number) => void;
  update: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};
const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "simple-kitchen-basket-v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try { const stored = localStorage.getItem(STORAGE_KEY); if (stored) setItems(JSON.parse(stored)); }
    finally { setHydrated(true); }
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }, [items, hydrated]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.reduce((s, i) => s + i.quantity, 0),
    subtotal: items.reduce((s, i) => s + i.product.price * i.quantity, 0),
    add(product, quantity = 1) {
      setItems((current) => {
        const existing = current.find((i) => i.product.id === product.id);
        return existing
          ? current.map((i) => i.product.id === product.id ? { ...i, quantity: Math.min(99, i.quantity + quantity) } : i)
          : [...current, { product, quantity }];
      });
    },
    update(productId, quantity) {
      if (quantity <= 0) return setItems((c) => c.filter((i) => i.product.id !== productId));
      setItems((c) => c.map((i) => i.product.id === productId ? { ...i, quantity: Math.min(99, quantity) } : i));
    },
    remove(productId) { setItems((c) => c.filter((i) => i.product.id !== productId)); },
    clear() { setItems([]); }
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
