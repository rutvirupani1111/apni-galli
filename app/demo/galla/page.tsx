import type { Metadata } from "next";
import { demoSid } from "@/lib/demo";
import { Galla } from "@/components/galla/Galla";
import { EmptyDesk } from "@/components/galla/EmptyDesk";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demo Galla", robots: { index: false } };

export default async function DemoGalla() {
  const sid = await demoSid(false);
  return (
    <main className="mx-auto min-h-dvh max-w-7xl px-4 py-6">
      <a href="/" className="sign rounded border-2 border-[#1e1b18] bg-[var(--rani)] px-3 py-1 text-xl text-[#fff4e0]" style={{ boxShadow: "var(--shadow-paper-sm)" }}>
        Apni Galli
      </a>
      <h1 className="mast t-mast mt-6">Demo Galla</h1>
      <p className="max-w-prose text-[var(--muted)]">Dukaan ka front desk, dono taraf se dekho: demo galli pe chit, booking ya order bhejo, phir yahan owner ban ke jawab do, pakka karo, ya Paisa mila dabao.</p>
      {sid ? (
        <div className="mt-6">
          <Galla desk="demo" name="Demo" demo />
        </div>
      ) : (
        <div className="mt-6">
          <EmptyDesk demo />
        </div>
      )}
    </main>
  );
}
