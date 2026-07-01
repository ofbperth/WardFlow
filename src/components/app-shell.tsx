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
    <div className="page-shell app-canvas md:pb-8">
      <div className="app-shell-frame flex min-h-[calc(100vh-1.5rem)] flex-col gap-3 md:min-h-[calc(100vh-2.5rem)] md:gap-4">
        <header className="app-panel px-3 py-3 md:px-5 md:py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <WardFlowLogo className="h-12 w-12 shrink-0 rounded-[18px]" sizes="48px" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--color-ink-2)]">
                  Clinical workspace
                </p>
                <p className="font-display text-[1.2rem] font-semibold text-foreground">WardFlow</p>
              </div>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <div className="status-strip rounded-full px-3 py-1.5 text-sm">
                <span className="font-semibold text-foreground">{profile.name}</span>
                <span className="text-[color:var(--color-ink-2)]"> · {labelForRole(profile.role)}</span>
              </div>
              <form action={logoutAction}>
                <PendingSubmitButton
                  pendingLabel="Signing out..."
                  className="button-danger min-w-[124px] shadow-none"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </PendingSubmitButton>
              </form>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              className="button-secondary inline-flex h-10 w-10 items-center justify-center rounded-full md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {mobileMenuOpen ? (
          <div className="app-panel space-y-3 p-3 md:hidden">
            <div className="panel-accent rounded-[18px] px-3 py-2.5">
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
                      "nav-chip flex items-center justify-between gap-3 rounded-[16px] px-3 py-2.5 text-sm font-semibold",
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
                    "nav-chip flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-sm font-semibold",
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

        <div className="grid flex-1 gap-3 lg:grid-cols-[256px_minmax(0,1fr)] lg:gap-4">
          <aside className="hidden lg:block">
            <div className="app-panel sticky top-4 p-3">
              <div className="panel-accent rounded-[18px] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--color-ink-2)]">
                  Workspace
                </p>
                <p className="mt-1 font-display text-base font-semibold text-foreground">
                  Ward operations
                </p>
                <p className="mt-1.5 text-sm leading-5 text-[color:var(--color-ink-2)]">
                  Patient flow, handover, and task coordination.
                </p>
              </div>

              <nav className="mt-3 space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "nav-chip flex items-center justify-between rounded-[16px] px-3 py-2.5 text-sm font-semibold",
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
                      "nav-chip mt-2 flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-sm font-semibold",
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

          <main className="min-w-0 pb-[calc(var(--mobile-bottom-nav-height)+env(safe-area-inset-bottom)+1.5rem)] lg:pb-0">
            {children}
          </main>
        </div>

        <div className="mobile-bottom-dock sticky bottom-0 z-30 mt-3 px-1 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-2 lg:hidden">
          <nav className="app-panel mx-auto flex min-h-[var(--mobile-bottom-nav-height)] w-full max-w-[760px] items-center justify-between px-1.5 py-1.5 shadow-[0_-10px_30px_rgba(15,23,42,0.06)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "nav-chip flex min-h-[3rem] flex-1 flex-col items-center justify-center gap-1 rounded-[16px] px-1 py-1.5 text-[10px] font-semibold",
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
      </div>
    </div>
  );
}
