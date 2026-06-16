"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Archive,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Shield,
  Stethoscope,
} from "lucide-react";
import { logoutAction } from "@/app/actions";
import { cn, getInitials, labelForRole } from "@/lib/utils";
import type { UserProfile } from "@/lib/types";

const navItems = [
  { href: "/wards", label: "Wards", icon: LayoutGrid },
  { href: "/discharged", label: "Discharged", icon: Archive },
  { href: "/handover", label: "Handover", icon: ClipboardList },
  { href: "/my-tasks", label: "My tasks", icon: Activity },
];

export function AppShell({
  profile,
  children,
}: {
  profile: UserProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="page-shell min-h-screen px-4 pb-28 pt-5 md:px-8 md:pb-10">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <header className="glass-card flex items-center justify-between rounded-[28px] px-5 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-mint-500/15 text-lg font-semibold text-mint-700">
              {getInitials(profile.name)}
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-foreground">WardFlow</p>
              <p className="text-sm text-muted">
                {profile.name} · {labelForRole(profile.role)}
              </p>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-white"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </form>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="glass-card sticky top-5 rounded-[32px] p-5">
              <div className="mb-5 flex items-center gap-3 rounded-3xl bg-mint-500/10 px-4 py-3">
                <Stethoscope className="h-5 w-5 text-mint-700" />
                <div>
                  <p className="font-display font-semibold">Operational layer</p>
                  <p className="text-sm text-muted">Ward round to handover, no paper chase.</p>
                </div>
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
                      <span className="text-xs opacity-80">{active ? "Live" : ""}</span>
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
                    Admin controls
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
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
