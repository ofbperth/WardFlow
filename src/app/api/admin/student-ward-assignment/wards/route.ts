import { NextResponse } from "next/server";
import { getAdminApiSession } from "@/lib/admin-api";
import { getStudentWardAssignmentBoardData } from "@/lib/wardflow";

export async function GET(request: Request) {
  const session = await getAdminApiSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const search = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";

  try {
    const data = await getStudentWardAssignmentBoardData(session);
    const wards = search
      ? data.wards.filter((entry) => entry.ward.name.toLowerCase().includes(search))
      : data.wards;

    return NextResponse.json({
      ok: true,
      data: wards,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load wards",
      },
      { status: 500 },
    );
  }
}
