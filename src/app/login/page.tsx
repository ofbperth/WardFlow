import { signInWithGoogle, startDemoSession } from "@/app/actions";
import { getLoginModeInfo } from "@/lib/auth";
import { SetupNotice } from "@/components/wardflow-ui";

export default function LoginPage() {
  const state = getLoginModeInfo();

  return (
    <main className="page-shell flex min-h-screen items-center justify-center px-4 py-8">
      <div className="glass-card soft-grid w-full max-w-5xl overflow-hidden rounded-[40px]">
        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="px-6 py-8 md:px-10 md:py-12">
            <p className="text-xs uppercase tracking-[0.28em] text-mint-700">WardFlow</p>
            <h1 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-tight text-foreground md:text-5xl">
              Operational clarity between ward round, task follow-up, and handover.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
              Mobile-first census, problem list, task board, handover mode, and full activity audit
              in one calm clinical workspace.
            </p>
          </section>

          <section className="border-t border-white/50 bg-white/55 px-6 py-8 md:px-8 md:py-10 lg:border-l lg:border-t-0">
            <div className="rounded-[32px] bg-white/82 p-6 shadow-xl shadow-emerald-950/8">
              <h2 className="font-display text-2xl font-semibold text-foreground">Sign in</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Google Login is the production path. Demo mode only appears when Supabase is not
                configured and the app is running locally.
              </p>

              <div className="mt-6 space-y-4">
                {state.hasIncompleteSupabaseSetup ? (
                  <SetupNotice
                    title="Supabase setup incomplete"
                    body="Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY before using live auth and database mode."
                  />
                ) : null}

                {state.supportsGoogleLogin ? (
                  <form action={signInWithGoogle}>
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center rounded-full bg-mint-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-mint-500/25 transition hover:bg-mint-600"
                    >
                      Continue with Google
                    </button>
                  </form>
                ) : null}

                {state.supportsDemoLogin ? (
                  <form action={startDemoSession}>
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center rounded-full border border-white/70 bg-white px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-mint-50"
                    >
                      Enter demo ward
                    </button>
                  </form>
                ) : null}

                {!state.supportsGoogleLogin && !state.supportsDemoLogin ? (
                  <SetupNotice
                    title="No login mode available"
                    body="This environment has neither live Supabase credentials nor local demo mode. Add the required environment variables or run locally without Supabase envs to use demo mode."
                  />
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
