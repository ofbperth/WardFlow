import { signInWithGoogle, startDemoSession } from "@/app/actions";
import { PendingSubmitButton } from "@/components/form-feedback";
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
              จัดการ ward round, task follow-up และ handover ให้ชัดเจนในที่เดียว
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
              หน้าจอออกแบบให้ใช้คล่องบนมือถือ พร้อม census, problem list, task board,
              handover และ activity audit ใน workflow เดียว
            </p>
          </section>

          <section className="border-t border-white/50 bg-white/55 px-6 py-8 md:px-8 md:py-10 lg:border-l lg:border-t-0">
            <div className="rounded-[32px] bg-white/82 p-6 shadow-xl shadow-emerald-950/8">
              <h2 className="font-display text-2xl font-semibold text-foreground">Sign in</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Production ใช้ Google Login ส่วน Demo mode จะขึ้นเมื่อยังไม่ได้ตั้งค่า
                Supabase และกำลังรันในเครื่อง local
              </p>

              <div className="mt-6 space-y-4">
                {state.hasIncompleteSupabaseSetup ? (
                  <SetupNotice
                    title="Supabase ยังตั้งค่าไม่ครบ"
                    body="ตั้งค่า NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY และ SUPABASE_SERVICE_ROLE_KEY ก่อนใช้ live auth และ database mode"
                  />
                ) : null}

                {state.supportsGoogleLogin ? (
                  <form action={signInWithGoogle}>
                    <PendingSubmitButton
                      pendingLabel="กำลังพาไป Google..."
                      className="flex w-full items-center justify-center rounded-full bg-mint-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-mint-500/25 transition hover:bg-mint-600"
                    >
                      เข้าด้วย Google
                    </PendingSubmitButton>
                  </form>
                ) : null}

                {state.supportsDemoLogin ? (
                  <form action={startDemoSession}>
                    <PendingSubmitButton
                      pendingLabel="กำลังเข้า demo..."
                      className="flex w-full items-center justify-center rounded-full border border-white/70 bg-white px-4 py-3 text-sm font-semibold text-foreground shadow-none transition hover:bg-mint-50"
                    >
                      เข้า Demo Ward
                    </PendingSubmitButton>
                  </form>
                ) : null}

                {!state.supportsGoogleLogin && !state.supportsDemoLogin ? (
                  <SetupNotice
                    title="ยังไม่มี login mode ที่ใช้ได้"
                    body="environment นี้ยังไม่มีทั้ง live Supabase credentials และ local demo mode ให้เพิ่ม env ที่จำเป็น หรือรัน local แบบไม่มี Supabase env เพื่อใช้ demo mode"
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
