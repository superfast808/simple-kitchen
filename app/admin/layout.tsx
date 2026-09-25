import type { Metadata } from "next";

export const metadata:Metadata={
  title:{default:"Operations Console | Simple Kitchen",template:"%s | Simple Kitchen Admin"},
  robots:{index:false,follow:false,nocache:true}
};

export default function AdminRootLayout({children}:{children:React.ReactNode}){
  return children;
}
