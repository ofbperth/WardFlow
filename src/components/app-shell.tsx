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
  Plus,
  Settings,
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
    <div className="page-shell min-h-screen px-4 pb-28 pt-5 md:px-8 md:pb-10">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <header className="glass-card flex items-center justify-between rounded-[28px] px-4 py-4 md:px-5">
          <div className="flex min-w-0 items-center gap-4">
            <WardFlowLogo className="h-14 w-14 shrink-0" sizes="56px" />
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold text-foreground">WardFlow</p>
              <p className="truncate text-sm text-muted">
                {profile.name} | {labelForRole(profile.role)}
              </p>
            </div>
          </div>

          <div className="hidden md:block">
            <form action={logoutAction}>
              <PendingSubmitButton
                pendingLabel="Signing out..."
                className="flex min-w-[144px] items-center justify-center gap-2 rounded-full border border-rose-500 bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-none hover:bg-rose-600"
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
              aria-label={mobileMenuOpen ? "ปิดเมนูการตั้งค่า" : "เปิดเมนูการตั้งค่า"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/75 text-foreground shadow-sm"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {mobileMenuOpen ? (
          <div className="glass-card rounded-[28px] p-4 md:hidden">
            <div className="space-y-2">
              {profile.role === "admin" ? (
                <Link
                  href="/admin/wards"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    pathname.startsWith("/admin")
                      ? "bg-slate-900 text-white"
                      : "bg-white/70 text-foreground",
                  )}
                >
                  <Shield className="h-4 w-4" />
                  Admin control
                </Link>
              ) : null}

              <form action={logoutAction}>
                <PendingSubmitButton
                  pendingLabel="Signing out..."
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500 bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-none hover:bg-rose-600"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </PendingSubmitButton>
              </form>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="glass-card sticky top-5 rounded-[32px] p-5">
              <nav className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition",
                        active
                          ? "bg-mint-500 text-white shadow-lg shadow-mint-500/25"
                          : "bg-white/60 text-foreground hover:bg-white",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </span>
                      <span className="text-xs opacity-80">{active ? "กำลังดู" : ""}</span>
                    </Link>
                  );
                })}
                {profile.role === "admin" ? (
                  <Link
                    href="/admin/wards"
                    className={cn(
                      "mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                      pathname.startsWith("/admin")
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100/80 text-slate-700 hover:bg-white",
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

      <nav className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-[min(820px,calc(100vw-24px))] items-center justify-between rounded-[30px] border border-white/65 bg-white/80 px-3 py-3 shadow-2xl shadow-emerald-950/10 backdrop-blur-2xl lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold transition",
                active ? "bg-mint-500 text-white" : "text-muted",
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
