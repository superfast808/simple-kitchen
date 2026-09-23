"use client";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { useCart } from "./CartProvider";

export function ProductCard({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { add } = useCart();
  return <article className={product.featured ? "product-card product-featured" : "product-card"}>
    <div className="product-image-wrap"><img className="product-image" src={product.image} alt="" loading="lazy"/>{product.featured && <span className="product-badge">SK Special</span>}</div>
    <div className="product-body">
      <div className="product-category">{product.category}</div>
      <h3>{product.name}</h3><p>{product.description}</p>
      {product.allergens?.length ? <div className="allergens">Contains: {product.allergens.join(", ")}</div> : null}
      <div className="product-bottom"><strong>£{product.price.toFixed(2)}</strong>
        <div className="product-actions">
          <input aria-label={`Quantity for ${product.name}`} type="number" min="1" max="20" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}/>
          <button className="btn btn-small" onClick={() => { add(product, qty); setAdded(true); setTimeout(() => setAdded(false), 1200); }}>{added ? "Added ✓" : "Add to basket"}</button>
        </div>
      </div>
    </div>
  </article>;
}
