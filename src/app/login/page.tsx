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
      <div className="mx-auto grid w-full max-w-6xl gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="app-panel soft-grid overflow-hidden rounded-[34px] px-6 py-8 md:px-8 md:py-10">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--color-ink-2)]">
              Ward management workspace
            </p>
            <h1 className="mt-4 max-w-xl font-display text-4xl font-semibold text-foreground text-balance sm:text-5xl">
              Minimal ward coordination for real clinical shifts.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--color-ink-2)] md:text-base">
              One quiet surface for patient flow, pending work, and handover. Designed to stay readable at speed.
            </p>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <div className="metric-tile p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-2)]">Patient board</p>
              <p className="mt-2 text-2xl font-display font-semibold text-foreground">Live</p>
            </div>
            <div className="metric-tile p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-2)]">Task flow</p>
              <p className="mt-2 text-2xl font-display font-semibold text-foreground">Track</p>
            </div>
            <div className="metric-tile p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-2)]">Handover</p>
              <p className="mt-2 text-2xl font-display font-semibold text-foreground">Ready</p>
            </div>
          </div>
        </section>

        <section className="app-panel w-full rounded-[34px] px-8 py-10">
          <div className="mx-auto flex max-w-sm flex-col items-center">
            <WardFlowLogo
              className="h-32 w-32 sm:h-36 sm:w-36"
              sizes="144px"
              priority
              imageClassName="object-contain drop-shadow-[0_18px_36px_rgba(43,102,120,0.16)]"
            />

            <h2 className="mt-4 text-center font-display text-3xl font-semibold text-foreground">
              Sign in to continue
            </h2>

            <p className="mt-3 text-center text-sm leading-6 text-[color:var(--color-ink-2)]">
              Use the configured hospital login flow or open demo mode when enabled.
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
                body="Add `SUPABASE_SERVICE_ROLE_KEY` to enable admin checks."
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
