import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy, in plain words" };

export default function Privacy() {
  const items: [string, string][] = [
    ["What a visitor sends", "When you send a chit, book a slot, place an order or sign up for postcards, the shop owner gets what you typed. Nobody else does."],
    ["No tracking cookies", "Lanes count visits as daily totals per building. There are no cookies for this, no IP addresses stored and no record per visitor. Rate limits use a salted hash of your IP that changes every day."],
    ["Demo lanes", "On a demo lane we set one cookie so your own demo front desk can show what you sent. Demo records are deleted after 24 hours."],
    ["Payments", "UPI payments go from your UPI app straight to the shop. Apni Galli never sees or holds money, and never asks for card numbers, OTPs, passwords, Aadhaar or PAN."],
    ["Newsletters", "Postcards need a double opt-in: nothing is sent until you click the confirm link. Every postcard has a one-click unsubscribe. We keep a record of when you agreed and from which form."],
    ["Deleting", "A visitor can delete their own chit from its status link. An owner can export everything as JSON from Settings, and deleting a lane removes its bookings, chits, orders and subscribers."],
    ["Owners", "Owner passwords are stored only as scrypt hashes. Sessions use an httpOnly cookie that lasts 30 days."],
  ];
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <a href="/" className="mono underline">
        Apni Galli
      </a>
      <h1 className="mast t-mast mt-4">Privacy, in plain words</h1>
      <dl className="mt-6 space-y-5">
        {items.map(([k, v]) => (
          <div key={k}>
            <dt className="sign text-xl">{k}</dt>
            <dd className="mt-1">{v}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
