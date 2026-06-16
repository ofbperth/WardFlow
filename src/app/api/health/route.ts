import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getSupabasePublicEnv, getSupabaseServiceRoleKey, hasLiveSupabase } from "@/lib/env";

export async function GET() {
  const timestamp = new Date().toISOString();

  if (!getSupabasePublicEnv()) {
    return NextResponse.json(
      {
        ok: false,
        service: "wardflow",
        timestamp,
        mode: "demo",
        reason: "Supabase public env is missing",
      },
      { status: 503 },
    );
  }

  if (!getSupabaseServiceRoleKey()) {
    return NextResponse.json(
      {
        ok: false,
        service: "wardflow",
        timestamp,
        mode: "partial",
        reason: "SUPABASE_SERVICE_ROLE_KEY is missing",
      },
      { status: 503 },
    );
  }

  const admin = createAdminSupabaseClient();
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        service: "wardflow",
        timestamp,
        mode: "partial",
        reason: "Supabase admin client is unavailable",
      },
      { status: 503 },
    );
  }

  const schemaCheck = await admin.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
  if (schemaCheck.error) {
    return NextResponse.json(
      {
        ok: false,
        service: "wardflow",
        timestamp,
        mode: hasLiveSupabase() ? "live" : "partial",
        reason: "Profiles table is not ready",
        details: schemaCheck.error.message,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    service: "wardflow",
    timestamp,
    mode: "live",
  });
}
