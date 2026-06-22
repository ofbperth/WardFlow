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
      <div className="mx-auto grid w-full max-w-6xl gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-card rounded-[34px] px-6 py-8 md:px-8 md:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
            Clinical workflow system
          </p>
          <h1 className="mt-3 max-w-xl font-display text-4xl font-semibold text-foreground sm:text-5xl">
            WardFlow
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
            Professional ward workspace for patient tracking, task coordination, and handover in one green clinical console.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border clinical-divider bg-white/88 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Patient board</p>
              <p className="mt-2 text-sm leading-6 text-foreground">See active patients, core diagnosis, and urgent work at a glance.</p>
            </div>
            <div className="rounded-[22px] border clinical-divider bg-white/88 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Task flow</p>
              <p className="mt-2 text-sm leading-6 text-foreground">Track ward tasks with clear status, owner, and blocked reasons.</p>
            </div>
            <div className="rounded-[22px] border clinical-divider bg-white/88 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Handover</p>
              <p className="mt-2 text-sm leading-6 text-foreground">Prepare structured sign-out without switching between screens.</p>
            </div>
          </div>
        </section>

        <section className="glass-card w-full rounded-[34px] px-8 py-10">
          <div className="mx-auto flex max-w-sm flex-col items-center">
            <WardFlowLogo
              className="h-32 w-32 sm:h-36 sm:w-36"
              sizes="144px"
              priority
              imageClassName="object-contain drop-shadow-[0_18px_36px_rgba(61,181,144,0.14)]"
            />

            <h2 className="mt-4 text-center font-display text-3xl font-semibold text-foreground">
              Sign in to continue
            </h2>
            <p className="mt-2 text-center text-sm leading-6 text-muted">
              เข้าใช้งานระบบบอร์ดวอร์ด, patient workspace และ handover console
            </p>

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
              <GoogleLoginButton className="flex w-full items-center justify-center rounded-full border border-mint-600 bg-mint-600 px-5 py-3.5 text-base font-semibold text-white transition hover:bg-mint-700" />
            ) : state.supportsDemoLogin ? (
              <form action={startDemoSession}>
                <PendingSubmitButton
                  pendingLabel="Opening demo..."
                  className="flex w-full items-center justify-center rounded-full border border-mint-600 bg-mint-600 px-5 py-3.5 text-base font-semibold text-white transition hover:bg-mint-700"
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
