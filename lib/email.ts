// Email transport. With RESEND_API_KEY it sends through Resend; without it every email is written to
// outbox_emails (the dev transport) and the owner can read it in Studio > Daak. Never claims delivery.
import type { Q } from "./db";
import { sha256 } from "./crypto";

export type Mail = {
  laneId?: string | null;
  ownerId?: string | null;
  to: string;
  kind: string;
  subject: string;
  text: string;
  replyTo?: string | null;
  unsubscribeUrl?: string;
  ics?: string;
};

export const emailLive = () => !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;

export async function queueMail(q: Q, m: Mail) {
  let delivered = "outbox";
  if (emailLive()) {
    const headers: Record<string, string> = {};
    if (m.unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${m.unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [m.to],
        subject: m.subject,
        text: m.text,
        reply_to: m.replyTo ?? undefined,
        headers,
        attachments: m.ics ? [{ filename: "booking.ics", content: Buffer.from(m.ics).toString("base64") }] : undefined,
      }),
    }).catch(() => null);
    delivered = r?.ok ? "resend" : "failed";
  }
  await q.query(
    `insert into outbox_emails (lane_id, owner_id, to_hash, to_addr, kind, subject, payload, delivered)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [m.laneId ?? null, m.ownerId ?? null, sha256(m.to.toLowerCase()), m.to, m.kind, m.subject, JSON.stringify({ text: m.text, ics: m.ics ? true : false }), delivered],
  );
  return delivered;
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
