import { createHash, createHmac, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { withSystem } from "./db";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export const rand = (bytes = 18) => randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

let secretPromise: Promise<string> | undefined;
/** HMAC secret: TOKEN_HMAC_SECRET, or one generated once and kept in the database. */
export function secret(): Promise<string> {
  if (process.env.TOKEN_HMAC_SECRET) return Promise.resolve(process.env.TOKEN_HMAC_SECRET);
  if (!secretPromise) {
    secretPromise = withSystem(async (q) => {
      await q.query("insert into app_secrets (k, v) values ('hmac', $1) on conflict do nothing", [rand(32)]);
      const r = await q.query<{ v: string }>("select v from app_secrets where k = 'hmac'");
      return r[0].v;
    }).catch((e) => {
      secretPromise = undefined;
      throw e;
    });
  }
  return secretPromise;
}

export async function hmac(s: string) {
  return createHmac("sha256", await secret()).update(s).digest("base64url");
}

/** Signed, expiring link token: base64url(payload).sig */
export async function signToken(payload: Record<string, unknown>, ttlDays = 30) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlDays * 86400000 })).toString("base64url");
  return `${body}.${(await hmac(body)).slice(0, 32)}`;
}
export async function verifyToken<T extends Record<string, unknown>>(tok: string): Promise<T | null> {
  const [body, sig] = tok.split(".");
  if (!body || !sig) return null;
  const want = (await hmac(body)).slice(0, 32);
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
    if (typeof p.exp !== "number" || p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
export async function checkPassword(pw: string, stored: string) {
  const [alg, n, salt, key] = stored.split("$");
  if (alg !== "scrypt") return false;
  const want = Buffer.from(key, "base64url");
  const got = await scrypt(pw, Buffer.from(salt, "base64url"), want.length, { N: Number(n), r: 8, p: 1 });
  return timingSafeEqual(want, got);
}

/** Sender identity for blocking and dedupe: HMAC of the normalised email or phone. Raw contact is never hashed alone. */
export async function senderHash(contact: string) {
  return (await hmac("sender:" + contact.trim().toLowerCase().replace(/[\s()-]/g, ""))).slice(0, 24);
}
/** Daily salted IP hash. Raw IPs are never stored. */
export async function ipHash(ip: string) {
  const day = new Date().toISOString().slice(0, 10);
  return (await hmac(`ip:${day}:${ip}`)).slice(0, 20);
}
