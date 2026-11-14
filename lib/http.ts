import { NextResponse } from "next/server";
import type { z } from "zod";
import { HttpError } from "./visitor";
import { pgCode } from "./db";

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function body<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "bad_json", "Request samajh nahi aaya");
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new HttpError(400, "invalid", issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "Invalid input", { field: issue?.path[0] });
  }
  return r.data;
}

export function fail(e: unknown) {
  if (e instanceof HttpError) return json({ error: e.message, code: e.code, ...e.extra }, e.status);
  const code = pgCode(e);
  if (code === "23505") return json({ error: "Yeh pehle se hai", code: "duplicate" }, 409);
  if (code === "23P01") return json({ error: "Slot abhi kisi aur ka hai", code: "slot_full" }, 409);
  if (code === "23514") return json({ error: "Value limit se bahar hai", code: "check" }, 400);
  console.error(e);
  return json({ error: "Server pe gadbad. Dobara try karo.", code: "server" }, 500);
}

/** Wraps a route handler: errors become JSON with the right status. */
export function route<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A) => {
    try {
      return await fn(...a);
    } catch (e) {
      return fail(e);
    }
  };
}

export function honeypot(b: { website?: string | null }) {
  if (b.website) throw new HttpError(400, "spam", "Nahi hua");
}
