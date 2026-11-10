import { getCurrentSessionContext } from "@/lib/auth";
import { getRequestOrigin } from "@/lib/env";
import type { ProgressSaveResult } from "@/lib/progress-autosave";
import { autosaveProblemNote } from "@/lib/wardflow";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== getRequestOrigin(request.headers)) {
    return Response.json({ ok: false }, { status: 403 });
  }

  try {
    const session = await getCurrentSessionContext();
    if (!session) {
      return Response.json({ ok: false, retryable: false, message: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่ ข้อความ draft ยังอยู่ในแท็บนี้" } satisfies ProgressSaveResult);
    }
    if (session.profile.role === "student") {
      return Response.json({ ok: false, retryable: false, message: "Student อ่าน Progress note ได้อย่างเดียว" } satisfies ProgressSaveResult);
    }
    return Response.json(await autosaveProblemNote(await request.json(), session));
  } catch {
    return Response.json({ ok: false, message: "ยังบันทึกไม่สำเร็จ ข้อความยังอยู่ในช่องนี้ ระบบจะลองใหม่อัตโนมัติ" } satisfies ProgressSaveResult);
  }
}
