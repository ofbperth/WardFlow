import { getCurrentSessionContext } from "@/lib/auth";
import { getRequestOrigin } from "@/lib/env";
import { saveProblemMaster } from "@/lib/wardflow";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== getRequestOrigin(request.headers)) {
    return Response.json({ ok: false }, { status: 403 });
  }
  const session = await getCurrentSessionContext();
  if (!session) return Response.json({ ok: false }, { status: 401 });

  try {
    const data = await request.formData();
    const updatedAt = data.get("updatedAt");
    if (data.get("id") && (typeof updatedAt !== "string" || !updatedAt.trim())) {
      return Response.json({ ok: false }, { status: 400 });
    }
    await saveProblemMaster(data, session);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}
