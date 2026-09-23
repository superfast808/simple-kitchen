"use client";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { useCart } from "./CartProvider";

export function ProductCard({ product }:{ product:Product }) {
  const [qty,setQty]=useState(1);
  const [selectedPrice,setSelectedPrice]=useState(product.priceOptions?.[0]??product.price);
  const [added,setAdded]=useState(false);
  const { add }=useCart();
  const isVariable=Boolean(product.priceOptions?.length);

  function addProduct() {
    const chosen=isVariable
      ? { ...product, id:product.id+"-"+selectedPrice, price:selectedPrice, priceOptions:undefined }
      : product;
    add(chosen,qty);
    setAdded(true);
    setTimeout(()=>setAdded(false),1200);
  }

  const priceText=isVariable
    ? "£"+Math.min(...product.priceOptions!).toFixed(2)+" - £"+Math.max(...product.priceOptions!).toFixed(2)
    : "£"+product.price.toFixed(2);

  return <article className={product.featured?"product-card product-featured":"product-card"}>
    <div className="product-image-wrap"><img className="product-image" src={product.image} alt="" loading="lazy"/>{product.featured&&<span className="product-badge">SK Special</span>}</div>
    <div className="product-body">
      <div className="product-category">{product.category}</div>
      <h3>{product.name}</h3><p>{product.description}</p>
      {product.allergens?.length?<div className="allergens">Contains: {product.allergens.join(", ")}</div>:null}
      <div className="product-bottom"><strong>{priceText}</strong>
        <div className="product-actions">
          {isVariable
            ? <select aria-label="Gift card amount" value={selectedPrice} onChange={(e)=>setSelectedPrice(Number(e.target.value))}>{product.priceOptions!.map((price)=><option value={price} key={price}>£{price.toFixed(2)}</option>)}</select>
            : <input aria-label={"Quantity for "+product.name} type="number" min="1" max="20" value={qty} onChange={(e)=>setQty(Math.max(1,Number(e.target.value)||1))}/>}
          <button className="btn btn-small" onClick={addProduct}>{added?"Added ✓":"Add to basket"}</button>
        </div>
      </div>
    </div>
  </article>;
}
