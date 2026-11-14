import { z } from "zod";
import { confirmHold } from "@/lib/visitor";
import { body, honeypot, json, route } from "@/lib/http";

const B = z.object({
  holdToken: z.string().min(10).max(60),
  name: z.string().trim().min(2).max(80),
  contact: z.string().trim().min(5).max(120),
  note: z.string().trim().max(300).optional(),
  replaces: z.string().max(60).nullable().optional(),
  website: z.string().optional(),
});

// Converting a hold needs the hold token, which only the visitor who won the hook has.
export const POST = route(async (req: Request, { params }: { params: Promise<{ handle: string }> }) => {
  const { handle } = await params;
  const b = await body(req, B);
  honeypot(b);
  return json(await confirmHold(handle, b), 201);
});
