import { z } from "zod";
import { slotsFor } from "@/lib/visitor";
import { json, route } from "@/lib/http";

const Q = z.object({ service: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export const GET = route(async (req: Request, { params }: { params: Promise<{ handle: string }> }) => {
  const { handle } = await params;
  const u = new URL(req.url).searchParams;
  const p = Q.safeParse({ service: u.get("service"), date: u.get("date") });
  if (!p.success) return json({ error: "service aur date chahiye" }, 400);
  return json(await slotsFor(handle, p.data.service, p.data.date));
});
