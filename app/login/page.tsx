import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { withSystem } from "@/lib/db";
import { checkPassword, hashPassword, ipHash } from "@/lib/crypto";
import { createSession, currentOwner, destroySession } from "@/lib/auth";
import { take } from "@/lib/ratelimit";
import { isEmail } from "@/lib/email";

export const metadata: Metadata = { title: "Andar aao", robots: { index: false } };

async function ipKey() {
  const h = await headers();
  return ipHash((h.get("x-forwarded-for") ?? "local").split(",")[0].trim());
}
const back = (next: string) => (next.startsWith("/") && !next.startsWith("//") ? next : "/studio");

async function signup(f: FormData) {
  "use server";
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const pw = String(f.get("password") ?? "");
  const name = String(f.get("name") ?? "").trim().slice(0, 60);
  const next = back(String(f.get("next") ?? "/studio"));
  const err = (m: string) => redirect(`/login?mode=signup&err=${encodeURIComponent(m)}&next=${encodeURIComponent(next)}`);
  if (!(await take(`signup:${await ipKey()}`, 5, 3600))) err("Bahut saare accounts. Ek ghante baad try karo.");
  if (!isEmail(email) || email.length > 160) err("Email sahi nahi lag raha");
  if (pw.length < 8 || pw.length > 200) err("Password kam se kam 8 characters ka");
  const hash = await hashPassword(pw);
  const r = await withSystem((q) =>
    q.query<{ id: string }>("insert into owners (email, password_hash, display_name) values ($1,$2,$3) on conflict do nothing returning id", [email, hash, name || null]),
  );
  if (!r[0]) err("Is email se account pehle se hai. Login karo.");
  await createSession(r[0].id);
  redirect(next);
}

async function login(f: FormData) {
  "use server";
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const pw = String(f.get("password") ?? "");
  const next = back(String(f.get("next") ?? "/studio"));
  const err = (m: string) => redirect(`/login?err=${encodeURIComponent(m)}&next=${encodeURIComponent(next)}`);
  if (!(await take(`login:${await ipKey()}`, 10, 900))) err("Bahut koshish. 15 minute baad try karo.");
  const r = await withSystem((q) => q.query<{ id: string; password_hash: string; is_demo: boolean }>("select id, password_hash, is_demo from owners where lower(email) = $1", [email]));
  const ok = r[0] && !r[0].is_demo && (await checkPassword(pw, r[0].password_hash).catch(() => false));
  if (!ok) err("Email ya password galat hai");
  await createSession(r[0].id);
  redirect(next);
}

async function logout() {
  "use server";
  await destroySession();
  redirect("/");
}

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const me = await currentOwner();
  const signupMode = sp.mode === "signup";
  const next = sp.next ?? "/studio";
  return (
    <main className="min-h-dvh px-4 py-10" style={{ background: "linear-gradient(var(--sky-1), var(--chalk) 60%)" }}>
      <div className="mx-auto max-w-md">
        <a href="/" className="sign inline-block rounded border-2 border-[#1e1b18] bg-[var(--rani)] px-3 py-1 text-xl text-[#fff4e0]" style={{ boxShadow: "var(--shadow-paper-sm)" }}>
          Apni Galli
        </a>
        {me ? (
          <div className="chit mt-8 px-5 pb-5 pt-6 text-[#1e1b18]">
            <p className="sign text-2xl">Aap andar ho</p>
            <p className="mt-1">{me.email}</p>
            <div className="mt-4 flex gap-2">
              <a className="cta" href="/studio">
                Studio kholo
              </a>
              <form action={logout}>
                <button className="btn">Bahar jao</button>
              </form>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mast t-mast mt-8">{signupMode ? "Apni galli banao" : "Wapas aao"}</h1>
            <div className="mt-4 flex gap-2" role="tablist">
              <a role="tab" aria-selected={!signupMode} className="btn" aria-pressed={!signupMode} href={`/login?next=${encodeURIComponent(next)}`}>
                Login
              </a>
              <a role="tab" aria-selected={signupMode} className="btn" aria-pressed={signupMode} href={`/login?mode=signup&next=${encodeURIComponent(next)}`}>
                Naya account
              </a>
            </div>
            {sp.err && (
              <p role="alert" className="mt-4 rounded border-2 border-[var(--sindoor)] bg-[var(--chalk)] p-2 text-[var(--sindoor)]">
                {sp.err}
              </p>
            )}
            <form action={signupMode ? signup : login} className="chit mt-4 px-5 pb-5 pt-6">
              <input type="hidden" name="next" value={next} />
              {signupMode && (
                <>
                  <label className="lbl" htmlFor="name">
                    Aapka naam
                  </label>
                  <input id="name" name="name" className="field" autoComplete="name" maxLength={60} />
                </>
              )}
              <label className="lbl" htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" required className="field" autoComplete="email" maxLength={160} />
              <label className="lbl" htmlFor="password">
                Password {signupMode && "(8+ characters)"}
              </label>
              <input id="password" name="password" type="password" required minLength={signupMode ? 8 : 1} className="field" autoComplete={signupMode ? "new-password" : "current-password"} />
              <button className="cta mt-5 w-full">{signupMode ? "Account banao" : "Andar aao"}</button>
              <p className="mt-3 text-xs text-[#4a4038]">Password scrypt se hash hota hai. Session cookie httpOnly hai, 30 din chalti hai.</p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
