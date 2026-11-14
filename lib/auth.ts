import { cookies } from "next/headers";
import { withSystem } from "./db";
import { rand, sha256 } from "./crypto";

export const SESSION_COOKIE = "ag_session";
const DAYS = 30;

export type Owner = { id: string; email: string; display_name: string | null };

export async function createSession(ownerId: string) {
  const token = rand(32);
  await withSystem((q) =>
    q.query("insert into sessions (id, owner_id, expires_at) values ($1, $2, now() + interval '30 days')", [sha256(token), ownerId]),
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const tok = jar.get(SESSION_COOKIE)?.value;
  if (tok) await withSystem((q) => q.query("delete from sessions where id = $1", [sha256(tok)]));
  jar.delete(SESSION_COOKIE);
}

export async function currentOwner(): Promise<Owner | null> {
  const jar = await cookies();
  const tok = jar.get(SESSION_COOKIE)?.value;
  if (!tok || tok.length > 100) return null;
  const rows = await withSystem((q) =>
    q.query<Owner>(
      `select o.id, o.email, o.display_name from sessions s join owners o on o.id = s.owner_id
        where s.id = $1 and s.expires_at > now()`,
      [sha256(tok)],
    ),
  );
  return rows[0] ?? null;
}

/** Owner of a lane, or null if this session does not own it. */
export async function ownLane(laneId: string): Promise<{ owner: Owner; laneId: string } | null> {
  if (!/^[0-9a-f-]{36}$/.test(laneId)) return null;
  const owner = await currentOwner();
  if (!owner) return null;
  const { withOwner } = await import("./db");
  const r = await withOwner(owner.id, (q) => q.query("select id from lanes where id = $1", [laneId]));
  return r.length ? { owner, laneId } : null;
}
