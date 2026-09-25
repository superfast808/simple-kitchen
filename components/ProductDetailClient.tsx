"use client";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { useCart } from "@/components/CartProvider";

export function ProductDetailClient({product,available}:{product:Product;available:boolean}){
  const gallery=product.images?.length?product.images:(product.image?[product.image]:[]);
  const [active,setActive]=useState(gallery[0]||"");
  const [qty,setQty]=useState(1);
  const [selectedPrice,setSelectedPrice]=useState(product.priceOptions?.[0]??product.price);
  const [added,setAdded]=useState(false);
  const {add}=useCart();
  const variable=Boolean(product.priceOptions?.length);

  function addProduct(){
    if(!available) return;
    const chosen=variable?{...product,id:product.id+"-"+selectedPrice,price:selectedPrice,priceOptions:undefined}:product;
    add(chosen,qty);
    setAdded(true);
    window.setTimeout(()=>setAdded(false),1200);
  }

  return <div className="product-detail-grid">
    <div className="product-gallery">
      <div className="product-detail-image-wrap">
        {active?<img src={active} alt={product.name} className="product-detail-image"/>:<div className="product-image-placeholder">Simple Kitchen</div>}
        {product.featured&&<span className="product-badge">SK Special</span>}
      </div>
      {gallery.length>1&&<div className="product-thumbnails">{gallery.map((image,index)=><button key={image+"-"+index} className={image===active?"active":""} onClick={()=>setActive(image)} aria-label={"View image "+(index+1)}><img src={image} alt=""/></button>)}</div>}
    </div>

    <div className="product-detail-copy">
      <div className="eyebrow">{product.category}</div>
      <h1>{product.name}</h1>
      <p className="product-lead">{product.longDescription||product.description}</p>

      {(product.calories||product.protein||product.carbs||product.fat)&&<div className="nutrition-grid">
        <div><strong>{product.calories??"—"}</strong><span>Calories</span></div>
        <div><strong>{product.protein??"—"}{product.protein!=null?"g":""}</strong><span>Protein</span></div>
        <div><strong>{product.carbs??"—"}{product.carbs!=null?"g":""}</strong><span>Carbs</span></div>
        <div><strong>{product.fat??"—"}{product.fat!=null?"g":""}</strong><span>Fat</span></div>
      </div>}

      {product.ingredients&&<section className="product-info-section"><h2>Ingredients & preparation</h2><p>{product.ingredients}</p></section>}
      {product.allergens?.length?<section className="product-info-section"><h2>Allergens</h2><div className="allergen-pills">{product.allergens.map((item)=><span key={item}>{item}</span>)}</div></section>:null}

      <div className={available?"product-availability available":"product-availability"}>
        <span></span>{available?"Available to order now":"Not available in the current ordering window"}
      </div>

      <div className="product-detail-buy">
        <div className="product-detail-price">{variable?"£"+Math.min(...product.priceOptions!).toFixed(2)+" – £"+Math.max(...product.priceOptions!).toFixed(2):"£"+product.price.toFixed(2)}</div>
        <div className="product-detail-controls">
          {variable?<select aria-label="Gift card value" value={selectedPrice} onChange={(e)=>setSelectedPrice(Number(e.target.value))}>{product.priceOptions!.map((price)=><option value={price} key={price}>£{price.toFixed(2)}</option>)}</select>:<input aria-label="Quantity" type="number" min="1" max="20" value={qty} onChange={(e)=>setQty(Math.max(1,Math.min(20,Number(e.target.value)||1)))}/>}
          <button className="btn" disabled={!available} onClick={addProduct}>{added?"Added ✓":"Add to basket"}</button>
        </div>
      </div>

      <div className="allergen-note"><strong>Kitchen notice:</strong> Produced in a kitchen which handles CELERY, WHEAT, FISH, CRUSTACEAN, EGG, MILK, MUSTARD, NUTS, PEANUTS, SESAME, SOY and SULPHITES.</div>
    </div>
  </div>;
}
