"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, requireAppSession } from "@/lib/auth";
import { getRequestOrigin, hasLiveSupabase, isDemoModeEnabled } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  bulkCreateTasks,
  deleteUser,
  deleteWard,
  dischargePatient,
  dischargePatientWithSummary,
  exportSummaryNoteDocument,
  hardDeletePatient,
  moveProblem,
  saveHandover,
  savePatient,
  saveProblem,
  saveProblemMaster,
  saveProblemProgressEntry,
  saveTask,
  saveTaskUpdate,
  saveTemplate,
  transferPatient,
  updateUserRole,
  saveWard,
  updateTaskStatus,
} from "@/lib/wardflow";

export async function signInWithGoogle() {
  if (!hasLiveSupabase()) {
    throw new Error("Google login is not configured");
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase unavailable");
  }

  const origin = getRequestOrigin(await headers());
  if (!origin) {
    throw new Error("Unable to resolve app origin for OAuth redirect");
  }

  const result = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=%2Fwards`,
      scopes: "openid email profile",
    },
  });

  if (result.error || !result.data.url) {
    throw new Error(result.error?.message ?? "Google login failed");
  }

  redirect(result.data.url);
}

export async function startDemoSession() {
  if (!isDemoModeEnabled()) {
    throw new Error("Demo mode unavailable");
  }

  const cookieStore = await cookies();
  cookieStore.set(DEMO_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });
  redirect("/wards");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_COOKIE);

  const supabase = await createServerSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  redirect("/login");
}

export async function saveWardAction(formData: FormData) {
  const session = await requireAppSession();
  await saveWard(formData, session);
}

export async function saveWardAdminAction(formData: FormData) {
  const session = await requireAppSession();
  await saveWard(formData, session);
  redirect("/admin/wards?toast=ward-saved");
}

export async function deleteWardAction(formData: FormData) {
  const session = await requireAppSession();
  await deleteWard(formData, session);
}

export async function deleteWardAdminAction(formData: FormData) {
  const session = await requireAppSession();
  await deleteWard(formData, session);
  redirect("/admin/wards?toast=ward-deleted");
}

export async function updateUserRoleAction(formData: FormData) {
  const session = await requireAppSession();
  await updateUserRole(formData, session);
}

export async function updateUserRoleAdminAction(formData: FormData) {
  const session = await requireAppSession();
  await updateUserRole(formData, session);
  redirect("/admin/wards?toast=role-saved");
}

export async function deleteUserAdminAction(formData: FormData) {
  const session = await requireAppSession();
  await deleteUser(formData, session);
  redirect("/admin/wards?toast=user-deleted");
}

export async function savePatientWardAction(formData: FormData) {
  const session = await requireAppSession();

  try {
    await savePatient(formData, session);
  } catch (error) {
    console.error("savePatientWardAction failed", {
      role: session.profile.role,
      actorId: session.profile.id,
      wardAssignment: session.profile.wardAssignment,
      targetWardId:
        typeof formData.get("wardId") === "string" ? String(formData.get("wardId")).trim() : null,
      message: error instanceof Error ? error.message : String(error),
    });
    redirect("/wards?error=patient-save-failed");
  }

  redirect("/wards?toast=patient-saved");
}

export async function savePatientDetailAction(formData: FormData) {
  const session = await requireAppSession();
  const patientId = await savePatient(formData, session);
  redirect(`/patients/${patientId}`);
}

export async function transferPatientAction(formData: FormData) {
  const session = await requireAppSession();
  const patientId = await transferPatient(formData, session);
  redirect(`/patients/${patientId}`);
}

export async function saveProblemAction(formData: FormData) {
  const session = await requireAppSession();
  await saveProblem(formData, session);
}

export async function saveProblemMasterAction(formData: FormData) {
  const session = await requireAppSession();
  await saveProblemMaster(formData, session);
}

export async function saveProblemProgressEntryAction(formData: FormData) {
  const session = await requireAppSession();
  await saveProblemProgressEntry(formData, session);
}

export async function reorderProblemAction(formData: FormData) {
  const session = await requireAppSession();
  await moveProblem(
    String(formData.get("patientId")),
    String(formData.get("problemId")),
    String(formData.get("direction")) === "down" ? "down" : "up",
    session,
  );
}

export async function saveTaskAction(formData: FormData) {
  const session = await requireAppSession();
  await saveTask(formData, session);
}

export async function quickCreateTasksAction(formData: FormData) {
  const session = await requireAppSession();
  const count = await bulkCreateTasks(formData, session);
  const wardId =
    typeof formData.get("wardId") === "string" ? String(formData.get("wardId")).trim() : "";
  redirect(
    wardId
      ? `/tasks/quick/${wardId}?toast=quick-task-saved&count=${count}`
      : `/tasks/quick?toast=quick-task-saved&count=${count}`,
  );
}

export async function updateTaskStatusAction(formData: FormData) {
  const session = await requireAppSession();
  const updatedAt =
    typeof formData.get("updatedAt") === "string" ? (formData.get("updatedAt") as string) : null;
  await updateTaskStatus(
    String(formData.get("patientId")),
    String(formData.get("taskId")),
    String(formData.get("status")) as Parameters<typeof updateTaskStatus>[2],
    updatedAt,
    session,
  );
}

export async function saveTaskUpdateAction(formData: FormData) {
  const session = await requireAppSession();
  await saveTaskUpdate(formData, session);
}

export async function saveHandoverAction(formData: FormData) {
  const session = await requireAppSession();
  await saveHandover(formData, session);
}

export async function saveTemplateAction(formData: FormData) {
  const session = await requireAppSession();
  await saveTemplate(formData, session);
}

export async function dischargePatientAction(formData: FormData) {
  const session = await requireAppSession();
  await dischargePatient(String(formData.get("patientId")), session);
}

export async function dischargePatientWithSummaryAction(formData: FormData) {
  const session = await requireAppSession();
  const patientId = String(formData.get("patientId"));
  await dischargePatientWithSummary(formData, session);
  redirect(`/discharged/${patientId}`);
}

export async function hardDeletePatientAction(formData: FormData) {
  const session = await requireAppSession();
  await hardDeletePatient(String(formData.get("patientId")), session);
  redirect("/discharged");
}

export async function exportSummaryNoteGoogleDocsAction(formData: FormData) {
  const session = await requireAppSession();
  const patientId = String(formData.get("patientId"));

  try {
    const result = await exportSummaryNoteDocument(session, patientId);
    redirect(
      `/patients/${patientId}/summary-note?export=success&docUrl=${encodeURIComponent(result.documentUrl)}`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to export summary note to Google Docs";
    redirect(
      `/patients/${patientId}/summary-note?export=error&message=${encodeURIComponent(message)}`,
    );
  }
}
