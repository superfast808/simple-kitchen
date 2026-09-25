"use client";
import { useMemo,useState } from "react";
import { useRouter } from "next/navigation";

type Item={
  id:string;name:string;description:string;price:number;category:string;week:number|null;
  image?:string;enabled:boolean;isCustom:boolean;sourceLabel:string;
};

export function AdminMenuClient({initial}:{initial:Item[]}){
  const router=useRouter();
  const [items,setItems]=useState(initial);
  const [week,setWeek]=useState("all");
  const [query,setQuery]=useState("");
  const [layout,setLayout]=useState<"cards"|"table">("cards");
  const [creating,setCreating]=useState(false);
  const [message,setMessage]=useState("");

  const visible=useMemo(()=>items.filter((item)=>{
    const matchWeek=week==="all"||String(item.week)===week||(week==="always"&&item.week===null);
    const hay=[item.name,item.description,item.category,item.sourceLabel].join(" ").toLowerCase();
    return matchWeek&&(!query||hay.includes(query.toLowerCase()));
  }),[items,week,query]);

  async function createProduct(){
    setCreating(true);setMessage("");
    try{
      const response=await fetch("/api/admin/products",{method:"POST"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to create product");
      router.push("/admin/menu/"+encodeURIComponent(data.product.id));
    }catch(error){
      setMessage(error instanceof Error?error.message:"Unable to create product");
      setCreating(false);
    }
  }

  async function toggle(item:Item){
    setMessage("");
    try{
      const response=await fetch("/api/admin/products/"+encodeURIComponent(item.id),{
        method:"PATCH",headers:{"content-type":"application/json"},
        body:JSON.stringify({
          enabled:!item.enabled,name:item.name,description:item.description,longDescription:item.description,ingredients:"",
          pricePence:Math.round(item.price*100),category:item.category,week:item.week,image:item.image||""
        })
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to update product");
      setItems((current)=>current.map((row)=>row.id===item.id?{...row,enabled:!row.enabled}:row));
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to update product");}
  }

  return <div>
    <div className="admin-toolbar admin-catalog-toolbar">
      <button className="admin-primary" disabled={creating} onClick={createProduct}>{creating?"Creating…":"+ New product"}</button>
      <input className="admin-input" placeholder="Search products…" value={query} onChange={(e)=>setQuery(e.target.value)}/>
      <select className="admin-input" value={week} onChange={(e)=>setWeek(e.target.value)}>
        <option value="all">All menu weeks</option>
        {[1,2,3,4,5,6].map((value)=><option key={value} value={value}>Week {value}</option>)}
        <option value="always">Always available</option>
      </select>
      <div className="admin-view-toggle"><button className={layout==="cards"?"active":""} onClick={()=>setLayout("cards")}>Cards</button><button className={layout==="table"?"active":""} onClick={()=>setLayout("table")}>Table</button></div>
      <span className="admin-muted">{visible.length} products</span>
    </div>
    {message&&<div className="admin-alert danger" style={{marginTop:12}}>{message}</div>}

    {layout==="cards"?<div className="admin-product-browser-grid">
      {visible.map((item)=><article className="admin-product-browser-card" key={item.id}>
        <button className="admin-product-browser-hit" onClick={()=>router.push("/admin/menu/"+encodeURIComponent(item.id))} aria-label={"Edit "+item.name}></button>
        <div className="admin-product-browser-image">{item.image?<img src={item.image} alt=""/>:<span>SK</span>}<span className={item.enabled?"admin-badge active":"admin-badge cancelled"}>{item.enabled?"Active":"Disabled"}</span></div>
        <div className="admin-product-browser-copy">
          <div className="admin-kicker">{item.week==null?"Always":("Week "+item.week)} · {item.category}</div>
          <h2>{item.name}</h2>
          <p>{item.description}</p>
          <div className="admin-product-browser-footer"><strong>£{item.price.toFixed(2)}</strong><small>{item.sourceLabel}</small></div>
        </div>
        <div className="admin-product-browser-actions">
          <button className="admin-secondary" onClick={()=>router.push("/admin/menu/"+encodeURIComponent(item.id))}>Edit product</button>
          <button className={item.enabled?"admin-switch on":"admin-switch"} onClick={()=>toggle(item)} title={item.enabled?"Disable":"Enable"}></button>
        </div>
      </article>)}
      {!visible.length&&<div className="admin-empty">No products match those filters.</div>}
    </div>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Week</th><th>Category</th><th>Price</th><th>Source</th><th>Status</th><th></th></tr></thead><tbody>
      {visible.map((item)=><tr key={item.id}>
        <td><div className="admin-product-table-name">{item.image?<img src={item.image} alt=""/>:<span>SK</span>}<div><strong>{item.name}</strong><small>{item.description}</small></div></div></td>
        <td>{item.week==null?"Always":"Week "+item.week}</td><td style={{textTransform:"capitalize"}}>{item.category}</td><td><strong>£{item.price.toFixed(2)}</strong></td><td>{item.sourceLabel}</td>
        <td><span className={item.enabled?"admin-badge active":"admin-badge cancelled"}>{item.enabled?"Active":"Disabled"}</span></td>
        <td><button className="admin-secondary" onClick={()=>router.push("/admin/menu/"+encodeURIComponent(item.id))}>Edit</button></td>
      </tr>)}
    </tbody></table></div>}
  </div>;
}
