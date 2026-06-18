import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  getRequestOrigin,
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
  hasLiveSupabase,
} from "@/lib/env";

const requiredTables = [
  "wards",
  "profiles",
  "patients",
  "problems",
  "ward_tasks",
  "task_updates",
  "handover_notes",
  "activity_logs",
  "task_templates",
  "discharge_summaries",
] as const;

const requiredPatientColumns = [
  "id",
  "ward_id",
  "bed",
  "display_name",
  "diagnosis",
  "status",
  "responsible_doctor_id",
  "allergy",
  "precaution",
  "code_status",
  "lifecycle",
  "discharged_at",
  "updated_by_id",
  "created_at",
  "updated_at",
] as const;

export async function GET(request: Request) {
  const timestamp = new Date().toISOString();
  const appUrl = getRequestOrigin(request.headers);

  if (!appUrl) {
    return NextResponse.json(
      {
        ok: false,
        service: "wardflow",
        timestamp,
        mode: "partial",
        reason: "Unable to resolve app origin",
      },
      { status: 503 },
    );
  }

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

  const tableChecks = await Promise.all(
    requiredTables.map(async (table) => {
      const result = await admin.from(table).select("*", { head: true, count: "exact" }).limit(1);
      return {
        table,
        ok: !result.error,
        error: result.error?.message ?? null,
      };
    }),
  );

  const missingTables = tableChecks.filter((entry) => !entry.ok);
  if (missingTables.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        service: "wardflow",
        timestamp,
        mode: hasLiveSupabase() ? "live" : "partial",
        reason: "Required tables are not ready",
        tableChecks,
      },
      { status: 503 },
    );
  }

  const patientColumnCheck = await admin.from("patients").select(requiredPatientColumns.join(",")).limit(1);
  const taskUpdatesColumnCheck = await admin
    .from("task_updates")
    .select("id, task_id, note, created_by_id, created_by_name, created_at")
    .limit(1);
  const dischargeColumnCheck = await admin
    .from("discharge_summaries")
    .select("id, patient_id, ward_id, created_by_id, created_by_name, admit_date, discharge_date")
    .limit(1);
  const activityColumnCheck = await admin
    .from("activity_logs")
    .select("id, patient_id, actor_id, actor_name, action, entity_type, entity_id")
    .limit(1);
  const templateSeedCheck = await admin
    .from("task_templates")
    .select("id, title, default_priority")
    .limit(1);

  const structuralChecks = [
    {
      name: "patients_columns",
      ok: !patientColumnCheck.error,
      error: patientColumnCheck.error?.message ?? null,
    },
    {
      name: "task_updates_columns",
      ok: !taskUpdatesColumnCheck.error,
      error: taskUpdatesColumnCheck.error?.message ?? null,
    },
    {
      name: "discharge_summary_columns",
      ok: !dischargeColumnCheck.error,
      error: dischargeColumnCheck.error?.message ?? null,
    },
    {
      name: "activity_log_columns",
      ok: !activityColumnCheck.error,
      error: activityColumnCheck.error?.message ?? null,
    },
    {
      name: "task_template_seed_read",
      ok: !templateSeedCheck.error,
      error: templateSeedCheck.error?.message ?? null,
    },
  ];

  const failedStructuralChecks = structuralChecks.filter((entry) => !entry.ok);
  if (failedStructuralChecks.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        service: "wardflow",
        timestamp,
        mode: "live",
        reason: "Schema is partially migrated",
        tableChecks,
        structuralChecks,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    service: "wardflow",
    timestamp,
    mode: "live",
    appUrl,
    tableChecks,
    structuralChecks,
    realtimeExpectedTables: [
      "patients",
      "problems",
      "ward_tasks",
      "task_updates",
      "handover_notes",
      "discharge_summaries",
    ],
    note: "Realtime publication membership is expected but not directly introspected from this route.",
  });
}
