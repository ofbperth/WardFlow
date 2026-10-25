"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const adminTabs = [
  { href: "/admin/wards", label: "Wards", thaiLabel: "จัดการวอร์ด" },
  {
    href: "/admin/student-ward-assignment",
    label: "Students",
    thaiLabel: "จัดนักศึกษาเข้าวอร์ด",
  },
  { href: "/admin/task-templates", label: "Templates", thaiLabel: "Template งาน" },
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
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-2xl px-3 py-2.5 text-sm font-semibold transition",
              active
                ? "bg-[color:var(--color-accent)] text-white "
                : "bg-[color:var(--color-paper-3)] text-[color:var(--color-accent-strong)] hover:bg-white",
            )}
          >
            <span className="block">{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
