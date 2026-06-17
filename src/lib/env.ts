type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

function normalizeEnvValue(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

export function getAppUrl(): string | null {
  const appUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_APP_URL);

  if (!appUrl) {
    return null;
  }

  return appUrl.replace(/\/+$/, "");
}

function firstHeaderValue(value: string | null): string | null {
  const normalized = value
    ?.split(",")[0]
    ?.trim();
  return normalized ? normalized : null;
}

export function getRequestOrigin(headers: Headers): string | null {
  const forwardedProto = firstHeaderValue(headers.get("x-forwarded-proto"));
  const forwardedHost = firstHeaderValue(headers.get("x-forwarded-host"));
  const host = firstHeaderValue(headers.get("host"));
  const protocol = forwardedProto ?? (host?.includes("localhost") ? "http" : "https");
  const hostname = forwardedHost ?? host;

  if (!hostname) {
    return getAppUrl();
  }

  return `${protocol}://${hostname}`;
}

export function getSupabaseServiceRoleKey(): string | null {
  return normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
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
