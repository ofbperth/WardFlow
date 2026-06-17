"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, requireAppSession } from "@/lib/auth";
import { getAppUrl, hasLiveSupabase, isDemoModeEnabled } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  deleteWard,
  dischargePatient,
  dischargePatientWithSummary,
  hardDeletePatient,
  moveProblem,
  saveHandover,
  savePatient,
  saveProblem,
  saveTask,
  saveTemplate,
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

  const origin = getAppUrl();
  if (!origin) {
    throw new Error("NEXT_PUBLIC_APP_URL is not configured");
  }

  const result = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
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

export async function savePatientAction(formData: FormData) {
  const session = await requireAppSession();
  await savePatient(formData, session);
}

export async function saveProblemAction(formData: FormData) {
  const session = await requireAppSession();
  await saveProblem(formData, session);
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

export async function updateTaskStatusAction(formData: FormData) {
  const session = await requireAppSession();
  await updateTaskStatus(
    String(formData.get("patientId")),
    String(formData.get("taskId")),
    String(formData.get("status")) as Parameters<typeof updateTaskStatus>[2],
    session,
  );
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
