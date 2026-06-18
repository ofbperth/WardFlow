import { NextResponse } from "next/server";
import { getAdminApiSession } from "@/lib/admin-api";
import { getStudentWardAssignmentBoardData } from "@/lib/wardflow";

export async function GET() {
  const session = await getAdminApiSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await getStudentWardAssignmentBoardData(session);
    return NextResponse.json({
      ok: true,
      data: data.students,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load students",
      },
      { status: 500 },
    );
  }
}
