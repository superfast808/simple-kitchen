import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminAuth";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const dynamic="force-dynamic";

export default async function AdminLoginPage(){
  const session=await getAdminSession();
  if(session) redirect("/admin");
  return <main className="admin-login-page"><AdminLoginForm/></main>;
}
