import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoUser } from "@/lib/demo-data";
import {
  canUseBrowserSupabase,
  hasAdminSupabase,
  hasIncompleteSupabaseSetup,
  hasLiveSupabase,
  isDemoModeEnabled,
} from "@/lib/env";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import type { SessionContext, UserProfile } from "@/lib/types";

export const DEMO_COOKIE = "wardflow-demo";

function mapProfileRow(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    name: String(row.name ?? "Unknown User"),
    email: String(row.email ?? ""),
    avatarUrl: (row.avatar_url as string | null | undefined) ?? null,
    role: (row.role as UserProfile["role"] | undefined) ?? "student",
    wardAssignment: (row.ward_assignment as string | null | undefined) ?? null,
    studentCode: (row.student_code as string | null | undefined) ?? null,
    academicYear: (row.academic_year as string | null | undefined) ?? null,
    isActive: (row.is_active as boolean | null | undefined) ?? true,
    createdAt: (row.created_at as string | null | undefined) ?? undefined,
    updatedAt: (row.updated_at as string | null | undefined) ?? undefined,
  };
}

async function ensureLiveProfile() {
  const supabase = await createServerSupabaseClient();
  const admin = hasAdminSupabase() ? createAdminSupabaseClient() : null;

  if (!supabase) {
    return null;
  }

  const claimsResult = await supabase.auth.getClaims();
  const claims = claimsResult.data?.claims;

  if (!claims?.sub) {
    return null;
  }

  const userResult = await supabase.auth.getUser();
  const user = userResult.data.user;

  const fallbackName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0] ??
    "WardFlow User";

  const profileClient =
    (admin ?? supabase) as unknown as {
      from: (table: string) => {
        upsert: (
          values: Record<string, unknown>,
          options?: { onConflict?: string },
        ) => Promise<{ error?: { message?: string } | null }>;
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            single: () => Promise<{
              error?: { message?: string } | null;
              data: Record<string, unknown> | null;
            }>;
          };
        };
      };
    };

  const upsertResult = await profileClient.from("profiles").upsert(
    {
      id: claims.sub,
      name: fallbackName,
      email: user?.email ?? "",
      avatar_url: (user?.user_metadata?.avatar_url as string | undefined) ?? null,
    },
    { onConflict: "id" },
  );
  if (upsertResult.error) {
    return null;
  }

  const profileResult = await profileClient
    .from("profiles")
    .select("*")
    .eq("id", claims.sub)
    .single();

  if (profileResult.error || !profileResult.data) {
    return null;
  }

  return mapProfileRow(profileResult.data);
}

export async function getCurrentSessionContext(): Promise<SessionContext | null> {
  if (hasLiveSupabase()) {
    const profile = await ensureLiveProfile();
    return profile ? { profile, mode: "live" } : null;
  }

  if (isDemoModeEnabled()) {
    const cookieStore = await cookies();
    if (cookieStore.get(DEMO_COOKIE)?.value === "1") {
      return { profile: demoUser, mode: "demo" };
    }
  }

  return null;
}

export async function requireAppSession() {
  const session = await getCurrentSessionContext();
  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireAdminSession() {
  const session = await requireAppSession();
  if (session.profile.role !== "admin") {
    redirect("/wards");
  }

  return session;
}

export function getLoginModeInfo() {
  return {
    supportsGoogleLogin: hasLiveSupabase(),
    supportsDemoLogin: isDemoModeEnabled(),
    hasIncompleteSupabaseSetup: hasIncompleteSupabaseSetup(),
    hasAnySupabaseConfig: canUseBrowserSupabase(),
  };
}
