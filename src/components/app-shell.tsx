"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  Archive,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  Shield,
  Stethoscope,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/actions";
import { PendingSubmitButton } from "@/components/form-feedback";
import { WardFlowLogo } from "@/components/wardflow-logo";
import { cn, labelForRole } from "@/lib/utils";
import type { UserProfile } from "@/lib/types";

const navItems = [
  { href: "/wards", label: "Wards", mobileLabel: "Wards", icon: LayoutGrid },
  { href: "/discharged", label: "Discharged", mobileLabel: "Discharged", icon: Archive },
  { href: "/handover", label: "Handover", mobileLabel: "Handover", icon: ClipboardList },
  { href: "/my-tasks", label: "Task", mobileLabel: "Task", icon: Activity },
  { href: "/tasks/quick", label: "Quick task entry", mobileLabel: "Quick", icon: Plus },
];

export function AppShell({
  profile,
  children,
}: {
  profile: UserProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="page-shell min-h-screen px-3 pb-[calc(9.5rem+env(safe-area-inset-bottom))] pt-4 md:px-6 md:pb-10 md:pt-6">
      <div className="mx-auto flex w-full max-w-[1580px] flex-col gap-4 md:gap-6">
        <header className="glass-card rounded-[30px] px-4 py-4 md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <WardFlowLogo className="h-14 w-14 shrink-0" sizes="56px" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                  Clinical Operations
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-foreground">WardFlow</p>
              </div>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <div className="rounded-full border clinical-divider bg-mint-50/80 px-4 py-2 text-sm text-mint-700">
                <span className="font-semibold">{profile.name}</span>
                <span className="text-muted"> · {labelForRole(profile.role)}</span>
              </div>
              <form action={logoutAction}>
                <PendingSubmitButton
                  pendingLabel="Signing out..."
                  className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold !text-rose-700 shadow-none hover:bg-rose-100"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </PendingSubmitButton>
              </form>
            </div>

            <div className="md:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-label={mobileMenuOpen ? "ปิดเมนูบัญชีและการนำทาง" : "เปิดเมนูบัญชีและการนำทาง"}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border clinical-divider bg-white/92 text-foreground shadow-sm"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="mt-4 hidden items-center justify-between gap-4 border-t clinical-divider pt-4 md:flex">
            <div className="flex min-w-0 items-center gap-3 text-sm text-muted">
              <Stethoscope className="h-4 w-4 text-mint-600" />
              <span>Hospital ward board for live patient, task, and handover workflow.</span>
            </div>
            <div className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Secure clinical workspace
            </div>
          </div>
        </header>

        {mobileMenuOpen ? (
          <div className="glass-card rounded-[28px] border clinical-divider p-4 md:hidden">
            <div className="rounded-[22px] border clinical-divider bg-mint-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                Account
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{profile.name}</p>
              <p className="text-sm text-muted">{labelForRole(profile.role)}</p>
            </div>

            <div className="mt-4 space-y-2.5">
              {profile.role === "admin" ? (
                <Link
                  href="/admin/wards"
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-[20px] border px-4 py-3 text-sm font-semibold transition",
                    pathname.startsWith("/admin")
                      ? "border-mint-600 bg-mint-600 text-white"
                      : "border-white/70 bg-white/86 text-foreground hover:bg-white",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Shield className="h-4 w-4" />
                    Admin control
                  </span>
                  <span className="text-xs opacity-75">Open</span>
                </Link>
              ) : null}

              <form action={logoutAction}>
                <PendingSubmitButton
                  pendingLabel="Signing out..."
                  className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold !text-rose-700 shadow-none hover:bg-rose-100"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </PendingSubmitButton>
              </form>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-6">
          <aside className="hidden lg:block">
            <div className="glass-card sticky top-6 rounded-[28px] p-4">
              <div className="mb-4 rounded-[20px] border clinical-divider bg-mint-50/75 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
                  Workspace
                </p>
                <p className="mt-1 font-display text-lg font-semibold text-foreground">
                  Ward operations
                </p>
              </div>

              <nav className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center justify-between rounded-[18px] border px-4 py-3 text-sm font-medium transition",
                        active
                          ? "border-mint-600 bg-mint-600 text-white shadow-lg shadow-mint-600/20"
                          : "border-white/70 bg-white/80 text-foreground hover:bg-white",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.16em] opacity-75">
                        {active ? "Live" : ""}
                      </span>
                    </Link>
                  );
                })}
                {profile.role === "admin" ? (
                  <Link
                    href="/admin/wards"
                    className={cn(
                      "mt-3 flex items-center gap-3 rounded-[18px] border px-4 py-3 text-sm font-medium transition",
                      pathname.startsWith("/admin")
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-white/70 bg-white/80 text-foreground hover:bg-white",
                    )}
                  >
                    <Shield className="h-4 w-4" />
                    Admin control
                  </Link>
                ) : null}
              </nav>
            </div>
          </aside>

          <main className="min-w-0">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto flex w-[min(780px,calc(100vw-18px))] items-center justify-between rounded-[24px] border clinical-divider bg-white/94 px-2 py-2 shadow-xl shadow-emerald-950/10 backdrop-blur-xl lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-1 rounded-[18px] px-1.5 py-2 text-[10px] font-semibold transition",
                active ? "bg-mint-600 text-white" : "text-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.mobileLabel}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
