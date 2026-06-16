type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

export function getSupabaseServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

export function hasLiveSupabase(): boolean {
  return Boolean(getSupabasePublicEnv() && getSupabaseServiceRoleKey());
}

export function canUseBrowserSupabase(): boolean {
  return Boolean(getSupabasePublicEnv());
}

export function isDemoModeEnabled(): boolean {
  return !canUseBrowserSupabase() && process.env.NODE_ENV !== "production";
}

export function hasIncompleteSupabaseSetup(): boolean {
  return canUseBrowserSupabase() && !getSupabaseServiceRoleKey();
}
