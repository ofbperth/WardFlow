import { NextResponse } from "next/server";
import { getAdminApiSession } from "@/lib/admin-api";
import { removeStudentWardAssignment } from "@/lib/wardflow";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const session = await getAdminApiSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { assignmentId } = await context.params;

  try {
    const result = await removeStudentWardAssignment({ assignmentId }, session);
    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to remove assignment",
      },
      { status: 500 },
    );
  }
}
