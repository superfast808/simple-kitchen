"use client";
import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export function SiteChrome({children}:{children:React.ReactNode}){
  const pathname=usePathname();
  const admin=pathname.startsWith("/admin");
  if(admin) return <>{children}</>;
  return <><Header/><main>{children}</main><Footer/></>;
}
