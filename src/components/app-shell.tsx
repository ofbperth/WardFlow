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
  X,
} from "lucide-react";
import { logoutAction } from "@/app/actions";
import { PendingSubmitButton } from "@/components/form-feedback";
import { WardFlowLogo } from "@/components/wardflow-logo";
import { cn, labelForRole } from "@/lib/utils";
import type { UserProfile } from "@/lib/types";

const navItems = [
  { href: "/wards", label: "Wards", mobileLabel: "Wards", icon: LayoutGrid },
  { href: "/discharged", label: "Discharged", mobileLabel: "Archive", icon: Archive },
  { href: "/handover", label: "Handover", mobileLabel: "Handover", icon: ClipboardList },
  { href: "/my-tasks", label: "Tasks", mobileLabel: "Tasks", icon: Activity },
  { href: "/tasks/quick", label: "Quick entry", mobileLabel: "Quick", icon: Plus },
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
    <div className="page-shell app-canvas pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-8">
      <div className="app-shell-frame flex flex-col gap-4 md:gap-6">
        <header className="app-panel px-4 py-4 md:px-6 md:py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <WardFlowLogo className="h-14 w-14 shrink-0 rounded-[22px]" sizes="56px" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--color-ink-2)]">
                  Clinical workspace
                </p>
                <p className="font-display text-[1.4rem] font-semibold text-foreground">WardFlow</p>
              </div>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <div className="status-strip rounded-full px-4 py-2 text-sm">
                <span className="font-semibold text-foreground">{profile.name}</span>
                <span className="text-[color:var(--color-ink-2)]"> · {labelForRole(profile.role)}</span>
              </div>
              <form action={logoutAction}>
                <PendingSubmitButton
                  pendingLabel="Signing out..."
                  className="button-danger min-w-[132px] shadow-none"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </PendingSubmitButton>
              </form>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
              className="button-secondary inline-flex h-11 w-11 items-center justify-center rounded-full md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {mobileMenuOpen ? (
          <div className="app-panel space-y-4 p-4 md:hidden">
            <div className="panel-accent rounded-[22px] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--color-ink-2)]">
                Account
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{profile.name}</p>
              <p className="text-sm text-[color:var(--color-ink-2)]">{labelForRole(profile.role)}</p>
            </div>

            <div className="grid gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "nav-chip flex items-center justify-between gap-3 rounded-[18px] px-4 py-3 text-sm font-semibold",
                      active && "nav-chip-active",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.18em]">
                      {active ? "Open" : ""}
                    </span>
                  </Link>
                );
              })}

              {profile.role === "admin" ? (
                <Link
                  href="/admin/wards"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "nav-chip flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm font-semibold",
                    pathname.startsWith("/admin") && "nav-chip-active",
                  )}
                >
                  <Shield className="h-4 w-4" />
                  Admin control
                </Link>
              ) : null}

              <form action={logoutAction}>
                <PendingSubmitButton
                  pendingLabel="Signing out..."
                  className="button-danger flex w-full justify-center shadow-none"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </PendingSubmitButton>
              </form>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
          <aside className="hidden lg:block">
            <div className="app-panel sticky top-6 p-4">
              <div className="panel-accent rounded-[22px] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--color-ink-2)]">
                  Workspace
                </p>
                <p className="mt-1 font-display text-lg font-semibold text-foreground">
                  Ward operations
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-2)]">
                  Patient flow, handover, and task coordination in one quiet clinical shell.
                </p>
              </div>

              <nav className="mt-4 space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "nav-chip flex items-center justify-between rounded-[18px] px-4 py-3 text-sm font-semibold",
                        active && "nav-chip-active",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.18em]">
                        {active ? "Live" : ""}
                      </span>
                    </Link>
                  );
                })}

                {profile.role === "admin" ? (
                  <Link
                    href="/admin/wards"
                    className={cn(
                      "nav-chip mt-2 flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm font-semibold",
                      pathname.startsWith("/admin") && "nav-chip-active",
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

      <nav className="app-panel fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto flex w-[min(760px,calc(100vw-18px))] items-center justify-between px-2 py-2 lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "nav-chip flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-1 rounded-[18px] px-1.5 py-2 text-[10px] font-semibold",
                active && "nav-chip-active",
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
