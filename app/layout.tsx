import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { SiteChrome } from "@/components/SiteChrome";

export const metadata:Metadata={
  metadataBase:new URL(process.env.NEXT_PUBLIC_SITE_URL||"https://simplekitchenprep.com"),
  title:{default:"Simple Kitchen | Chef Prepared Meals",template:"%s | Simple Kitchen"},
  description:"Fresh, flavour-packed chef prepared meals designed to fit around your lifestyle. Weekly ordering, delivery, collection and meal subscriptions."
};

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
  return <html lang="en"><body><CartProvider><SiteChrome>{children}</SiteChrome></CartProvider></body></html>;
}
