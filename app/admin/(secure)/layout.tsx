import { requireAdmin } from "@/lib/adminAuth";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic="force-dynamic";

export default async function AdminSecureLayout({children}:{children:React.ReactNode}){
  const session=await requireAdmin();
  return <div className="admin-app">
    <AdminNav name={session.displayName} role={session.role}/>
    <section className="admin-main">{children}</section>
  </div>;
}
