import { cookies } from "next/headers";
import { rand } from "./crypto";

export const DEMO_COOKIE = "ag_demo";

/** The visitor's demo scope: chits, bookings and orders on demo lanes land in their own demo Galla. */
export async function demoSid(create: boolean): Promise<string | null> {
  const jar = await cookies();
  const cur = jar.get(DEMO_COOKIE)?.value;
  if (cur && /^[\w-]{16,40}$/.test(cur)) return cur;
  if (!create) return null;
  const sid = rand(18);
  jar.set(DEMO_COOKIE, sid, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 86400 });
  return sid;
}
