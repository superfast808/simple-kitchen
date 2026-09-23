"use client";
import Link from "next/link";
import { useCart } from "./CartProvider";

export function BasketClient() {
  const { items, subtotal, update, remove } = useCart();
  if (!items.length) return <div className="empty-state"><h2>Your basket is empty</h2><p>Have a look at this week's menu and add your favourites.</p><Link href="/order" className="btn">Browse the menu</Link></div>;
  return <div className="basket-layout">
    <div className="basket-items">{items.map(({product,quantity}) => <article className="basket-row" key={product.id}><img src={product.image} alt=""/><div className="basket-row-main"><h3>{product.name}</h3><p>£{product.price.toFixed(2)} each</p><div className="basket-controls"><button onClick={() => update(product.id,quantity-1)}>−</button><span>{quantity}</span><button onClick={() => update(product.id,quantity+1)}>+</button><button className="remove-link" onClick={() => remove(product.id)}>Remove</button></div></div><strong>£{(product.price*quantity).toFixed(2)}</strong></article>)}</div>
    <aside className="basket-summary"><div className="eyebrow">Order summary</div><div className="summary-line"><span>Subtotal</span><strong>£{subtotal.toFixed(2)}</strong></div><p>Delivery or collection options are chosen at checkout.</p><Link className="btn full" href="/checkout">Continue to checkout</Link></aside>
  </div>;
}
