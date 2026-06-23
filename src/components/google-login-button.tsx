"use client";

import { useState } from "react";
import { SetupNotice } from "@/components/wardflow-ui";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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

          const supabase = createClient();
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
          "button-accent inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg disabled:cursor-not-allowed disabled:opacity-70",
          className,
        )}
      >
        {pending ? "Opening Google..." : "Log in with Google"}
      </button>
    </>
  );
}
