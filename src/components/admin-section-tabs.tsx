"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const adminTabs = [
  { href: "/admin/wards", label: "Ward management", thaiLabel: "จัดการวอร์ด" },
  {
    href: "/admin/student-ward-assignment",
    label: "Student Ward Assignment",
    thaiLabel: "จัดนักศึกษาเข้าวอร์ด",
  },
  { href: "/admin/task-templates", label: "Task templates", thaiLabel: "Template งาน" },
];

export function AdminSectionTabs() {
  const pathname = usePathname();

  return (
    <div className="app-panel flex flex-wrap gap-2 rounded-[26px] p-2">
      {adminTabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-2xl px-4 py-3 text-sm font-semibold transition",
              active
                ? "bg-[color:var(--color-accent)] text-white shadow-lg shadow-[color:var(--color-shadow)]"
                : "bg-[color:var(--color-paper-3)] text-[color:var(--color-accent-strong)] hover:bg-white",
            )}
          >
            <span className="block">{tab.label}</span>
            <span className={cn("block text-xs", active ? "text-white/85" : "text-[color:var(--color-ink-2)]")}>
              {tab.thaiLabel}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
