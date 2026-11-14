import { z } from "zod";
import { body, json, route } from "@/lib/http";
import { safeUrl } from "@/lib/lane";
import { take, clientIp } from "@/lib/ratelimit";
import { ipHash } from "@/lib/crypto";
import { HttpError } from "@/lib/visitor";

const B = z.object({ url: z.string().url().max(300) });

function isPrivateHost(h: string) {
  return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.|\[?::1\]?|.*\.internal$|.*\.local$)/i.test(h);
}

// Quick fill: fetch a Linktree-style page (5 s timeout, 1 MB cap) and keep only its <a href> links.
export const POST = route(async (req: Request) => {
  const { url } = await body(req, B);
  if (!(await take(`lt:${await ipHash(clientIp(req))}`, 10, 600))) throw new HttpError(429, "rate", "Thoda ruko");
  const u = new URL(url);
  if (u.protocol !== "https:" || isPrivateHost(u.hostname)) throw new HttpError(400, "bad_url", "Sirf public https link");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  let html = "";
  try {
    const r = await fetch(u, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "ApniGalli-LinkImport/1.0" } });
    const reader = r.body?.getReader();
    let size = 0;
    const dec = new TextDecoder();
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1048576) break;
      html += dec.decode(value, { stream: true });
    }
  } catch {
    throw new HttpError(400, "fetch", "Page nahi khula (5 second)");
  } finally {
    clearTimeout(t);
  }
  const links: { label: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = safeUrl(m[1].startsWith("/") ? new URL(m[1], u).toString() : m[1]);
    if (!href || seen.has(href)) continue;
    try {
      if (new URL(href).hostname === u.hostname) continue; // skip the link page's own chrome
    } catch {}
    const label = m[2].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, 80);
    seen.add(href);
    links.push({ label: label || href, url: href });
    if (links.length >= 20) break;
  }
  return json({ links });
});
