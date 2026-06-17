import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabasePublicEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));
  const code = requestUrl.searchParams.get("code");
  const authError = requestUrl.searchParams.get("error");
  const authErrorDescription = requestUrl.searchParams.get("error_description");
  const redirectResponse = NextResponse.redirect(new URL(nextPath, requestUrl.origin));

  const config = getSupabasePublicEnv();
  if (authError) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(authErrorDescription ?? authError)}`,
        requestUrl.origin,
      ),
    );
  }

  if (!code || !config) {
    return NextResponse.redirect(
      new URL("/login?error=Missing+OAuth+code+or+Supabase+config", requestUrl.origin),
    );
  }

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => {
          redirectResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin),
    );
  }

  return redirectResponse;
}

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/wards";
  }

  return value;
}
