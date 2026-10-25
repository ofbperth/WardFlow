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
    <main className="page-shell flex min-h-screen items-center px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        <section className="app-panel w-full rounded-[34px] px-5 py-8">
          <div className="mx-auto flex max-w-sm flex-col items-center">
            <WardFlowLogo
              className="h-20 w-20"
              sizes="80px"
              priority
              imageClassName="object-contain"
            />

            <h1 className="mt-4 text-center font-display text-3xl font-semibold text-foreground">
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
                title="Sign-in setup incomplete"
                body="Contact your administrator."
              />
            ) : null}

            {state.supportsGoogleLogin ? (
              <GoogleLoginButton className="button-accent flex w-full items-center justify-center rounded-full px-5 py-3.5 text-base font-semibold" />
            ) : state.supportsDemoLogin ? (
              <form action={startDemoSession}>
                <PendingSubmitButton
                  pendingLabel="Opening demo..."
                  className="button-accent flex w-full items-center justify-center rounded-full px-5 py-3.5 text-base font-semibold"
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
        </section>
      </div>
    </main>
  );
}
