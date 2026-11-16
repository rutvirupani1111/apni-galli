// Signed booking link: cancelling is a deliberate tap on the booking's own page, never a GET side effect
// (mail scanners open links), so this only sends the visitor there.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{16,40}$/.test(token)) return new Response("Not found", { status: 404 });
  return Response.redirect(new URL(`/c/${token}#cancel`, req.url), 302);
}
