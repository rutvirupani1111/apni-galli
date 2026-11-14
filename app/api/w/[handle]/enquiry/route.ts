import { createEnquiry, HttpError } from "@/lib/visitor";
import { json, route } from "@/lib/http";
import { clientIp, turnstileOk, visitorWriteAllowed } from "@/lib/ratelimit";
import { withSystem } from "@/lib/db";
import { demoSid } from "@/lib/demo";

function sniff(b: Buffer): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (b.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

// Multipart: scene, idem, fields (JSON), optional file (1 MB, type checked by magic bytes, not the extension).
export const POST = route(async (req: Request, { params }: { params: Promise<{ handle: string }> }) => {
  const { handle } = await params;
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    throw new HttpError(400, "bad_form", "Form samajh nahi aaya");
  }
  if (fd.get("website")) throw new HttpError(400, "spam", "Nahi hua");
  const scene = String(fd.get("scene") ?? "gate").slice(0, 20);
  const idem = String(fd.get("idem") ?? "");
  if (!/^[\w-]{8,64}$/.test(idem)) throw new HttpError(400, "idem", "Request id missing");
  let fields: Record<string, string | number>;
  try {
    fields = JSON.parse(String(fd.get("fields") ?? "{}"));
    if (typeof fields !== "object" || fields === null || Array.isArray(fields)) throw new Error();
  } catch {
    throw new HttpError(400, "bad_fields", "Chit samajh nahi aayi");
  }
  const lane = (await withSystem((q) => q.query<{ id: string; is_demo: boolean }>("select id, is_demo from lanes where handle = $1", [handle])))[0];
  if (!lane) throw new HttpError(404, "no_lane", "Yeh galli nahi mili");
  if (!(await turnstileOk(String(fd.get("turnstile") ?? "") || undefined, clientIp(req)))) throw new HttpError(403, "turnstile", "Bot check fail hua");
  if (!(await visitorWriteAllowed(req, lane.id, "enquiry"))) throw new HttpError(429, "rate", "Bahut saari chits. 10 minute baad try karo.");
  let file: { data: Buffer; mime: string } | null = null;
  const f = fd.get("file");
  if (f && typeof f !== "string" && f.size > 0) {
    if (f.size > 1048576) throw new HttpError(413, "too_big", "File 1 MB se badi hai", { field: "file" });
    const data = Buffer.from(await f.arrayBuffer());
    const mime = sniff(data);
    if (!mime) throw new HttpError(415, "type", "Sirf JPG, PNG, WebP ya PDF", { field: "file" });
    file = { data, mime };
  }
  const r = await createEnquiry(handle, { scene, fields, idem, demoSid: lane.is_demo ? await demoSid(true) : null, file });
  return json({ token: r.publicToken }, r.replay ? 200 : 201);
});
