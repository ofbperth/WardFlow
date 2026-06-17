"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { SetupNotice } from "@/components/wardflow-ui";
import { cn } from "@/lib/utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

let browserClient: ReturnType<typeof createClient> | null = null;

function getBrowserSupabaseClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabasePublishableKey);
  }

  return browserClient;
}

export function GoogleLoginButton({
  className,
}: {
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error ? (
        <div className="mb-4">
          <SetupNotice title="Login failed" body={error} />
        </div>
      ) : null}
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={async () => {
          setError(null);

          const supabase = getBrowserSupabaseClient();
          if (!supabase) {
            setError("Supabase public config is missing.");
            return;
          }

          setPending(true);

          const redirectTo = `${window.location.origin}/auth/callback?next=%2Fwards`;
          const result = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo,
              scopes: "openid email profile",
            },
          });

          if (result.error) {
            setPending(false);
            setError(result.error.message);
          }
        }}
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-mint-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-mint-500/25 transition hover:bg-mint-600 disabled:cursor-not-allowed disabled:opacity-70",
          className,
        )}
      >
        {pending ? "Opening Google..." : "Log in with Google"}
      </button>
    </>
  );
}
