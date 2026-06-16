import { NextResponse } from "next/server";
import { hasLiveSupabase } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "wardflow",
    timestamp: new Date().toISOString(),
    mode: hasLiveSupabase() ? "live" : "demo",
  });
}
