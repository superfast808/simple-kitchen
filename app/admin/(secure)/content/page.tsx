import { AdminContentClient } from "@/components/admin/AdminContentClient";
import { getAllHeroConfigs } from "@/lib/pageContent";

export const dynamic="force-dynamic";

export default async function AdminContentPage(){
  const heroes=await getAllHeroConfigs();
  return <div className="admin-page">
    <header className="admin-page-head"><div><div className="admin-kicker">Website content</div><h1>Content & heroes</h1><p>Edit page hero titles, copy, locally stored backgrounds and presentation without redeploying.</p></div></header>
    <AdminContentClient initial={heroes}/>
  </div>;
}
