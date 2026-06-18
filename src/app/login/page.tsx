import { startDemoSession } from "@/app/actions";
import { SetupNotice } from "@/components/wardflow-ui";
import { PendingSubmitButton } from "@/components/form-feedback";
import { GoogleLoginButton } from "@/components/google-login-button";
import { WardFlowLogo } from "@/components/wardflow-logo";
import { getLoginModeInfo } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const state = getLoginModeInfo();
  const params = (await searchParams) ?? {};

  return (
    <main className="page-shell flex min-h-screen items-center justify-center px-4 py-8">
      <div className="glass-card w-full max-w-md rounded-[40px] px-8 py-10 text-center">
        <div className="mx-auto flex max-w-xs flex-col items-center">
          <WardFlowLogo
            className="h-44 w-44 sm:h-48 sm:w-48"
            sizes="192px"
            priority
            imageClassName="object-contain drop-shadow-[0_24px_48px_rgba(61,181,144,0.22)]"
          />

          <h1 className="mt-3 font-display text-4xl font-semibold text-foreground sm:text-5xl">
            WardFlow
          </h1>

          <div className="mt-8 w-full">
            {params.error ? (
              <SetupNotice
                title="Login failed"
                body={params.error}
              />
            ) : null}
            {state.hasIncompleteSupabaseSetup ? (
              <SetupNotice
                title="Partial Supabase setup"
                body="Google login should work, but server-side admin checks are still unavailable until SUPABASE_SERVICE_ROLE_KEY is added."
              />
            ) : null}

            {state.supportsGoogleLogin ? (
              <GoogleLoginButton className="flex w-full items-center justify-center rounded-full bg-mint-500 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-mint-500/25 transition hover:bg-mint-600" />
            ) : state.supportsDemoLogin ? (
              <form action={startDemoSession}>
                <PendingSubmitButton
                  pendingLabel="Opening demo..."
                  className="flex w-full items-center justify-center rounded-full bg-mint-500 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-mint-500/25 transition hover:bg-mint-600"
                >
                  Enter Demo
                </PendingSubmitButton>
              </form>
            ) : (
              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center justify-center rounded-full bg-slate-200 px-5 py-3.5 text-base font-semibold text-slate-500"
              >
                Login unavailable
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
