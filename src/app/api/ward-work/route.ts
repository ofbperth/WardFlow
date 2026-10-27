import { getCurrentSessionContext } from "@/lib/auth";
import { getRequestOrigin } from "@/lib/env";
import { saveTask } from "@/lib/wardflow";

// A small acknowledgement keeps creation independent of the Patient page's RSC refresh.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== getRequestOrigin(request.headers)) {
    return Response.json({ ok: false }, { status: 403 });
  }
  const session = await getCurrentSessionContext();
  if (!session) return Response.json({ ok: false }, { status: 401 });

  try {
    const data = await request.formData();
    // This endpoint only creates; edits retain their existing conflict checks.
    if (data.get("id")) return Response.json({ ok: false }, { status: 400 });
    await saveTask(data, session);
    return Response.json({ ok: true });
  } catch {
    // Do not expose clinical data or database errors in a public API response.
    return Response.json({ ok: false }, { status: 400 });
  }
}
