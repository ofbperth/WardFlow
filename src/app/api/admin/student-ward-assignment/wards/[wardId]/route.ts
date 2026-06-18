import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiSession } from "@/lib/admin-api";
import { saveStudentWardAssignments } from "@/lib/wardflow";

const requestSchema = z.object({
  studentIds: z.array(z.string().uuid()).default([]),
  forceMove: z.boolean().default(false),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ wardId: string }> },
) {
  const session = await getAdminApiSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { wardId } = await context.params;

  try {
    const body = requestSchema.parse(await request.json());
    const result = await saveStudentWardAssignments(
      {
        wardId,
        studentIds: body.studentIds,
        forceMove: body.forceMove,
      },
      session,
    );

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save assignments";
    if (message.startsWith("MOVE_REQUIRED:")) {
      return NextResponse.json(
        {
          ok: false,
          error: "MOVE_REQUIRED",
          detail: message.slice("MOVE_REQUIRED:".length),
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
