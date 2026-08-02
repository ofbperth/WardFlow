import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiSession } from "@/lib/admin-api";
import { getResidentWardAssignmentBoardData, saveResidentWardAssignments } from "@/lib/wardflow";

const requestSchema = z.object({ wardId: z.string().min(1), residentIds: z.array(z.string().min(1)).default([]) });

export async function GET() {
  const session = await getAdminApiSession();
  if (!session) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, data: await getResidentWardAssignmentBoardData(session) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to load assignments" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  try {
    const body = requestSchema.parse(await request.json());
    return NextResponse.json({ ok: true, data: await saveResidentWardAssignments(body, session) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to save assignments" }, { status: 400 });
  }
}
