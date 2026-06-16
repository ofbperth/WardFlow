"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, requireAppSession } from "@/lib/auth";
import { hasLiveSupabase, isDemoModeEnabled } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  moveProblem,
  saveHandover,
  savePatient,
  saveProblem,
  saveTask,
  saveTemplate,
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

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
