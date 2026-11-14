import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Mono, Mukta, Rozha_One, Yatra_One } from "next/font/google";
import "./globals.css";

const sign = Yatra_One({ weight: "400", subsets: ["latin", "devanagari"], variable: "--f-sign", preload: true, display: "swap" });
const mast = Rozha_One({ weight: "400", subsets: ["latin", "devanagari"], variable: "--f-mast", preload: false, display: "swap" });
const body = Bricolage_Grotesque({ subsets: ["latin"], variable: "--f-body", axes: ["opsz", "wdth"], preload: true, display: "swap" });
const deva = Mukta({ weight: ["400", "600"], subsets: ["devanagari"], variable: "--f-body-deva", preload: false, display: "swap" });
const mono = DM_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--f-mono", preload: false, display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_URL ?? "https://apnigalli.vercel.app"),
  title: { default: "Apni Galli", template: "%s | Apni Galli" },
  description: "A small illustrated street for your small business: bookings that cannot clash, orders with daily stock, enquiry chits and a newsletter, and a front desk to answer them all.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF4E0" },
    { media: "(prefers-color-scheme: dark)", color: "#17131C" },
  ],
};

// Reads the per-device Calm, Saada (low power) and theme choices before first paint, so nothing flashes.
const boot = `try{var d=document.documentElement,s=localStorage;var c=s.getItem('galli-calm');if(c==='1')d.dataset.calm='1';var p=s.getItem('galli-saada');var n=navigator,lp=p==='1'||(p===null&&((n.deviceMemory&&n.deviceMemory<4)||(n.hardwareConcurrency&&n.hardwareConcurrency<=4)||(n.connection&&n.connection.saveData)));if(lp)d.dataset.saada='1';var t=s.getItem('galli-theme');if(t)d.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sign.variable} ${mast.variable} ${body.variable} ${deva.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
