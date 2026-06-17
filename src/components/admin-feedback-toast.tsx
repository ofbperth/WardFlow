"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const toastCopy: Record<string, string> = {
  "ward-saved": "Ward saved",
  "ward-deleted": "Ward deleted",
  "role-saved": "User role updated",
  "user-deleted": "User deleted",
};

export function AdminFeedbackToast({ toastKey }: { toastKey?: string }) {
  const [visible, setVisible] = useState(Boolean(toastKey && toastCopy[toastKey]));

  useEffect(() => {
    if (!toastKey || !toastCopy[toastKey]) return;

    const timeout = window.setTimeout(() => {
      setVisible(false);
    }, 2600);

    const url = new URL(window.location.href);
    url.searchParams.delete("toast");
    window.history.replaceState({}, "", url.toString());

    return () => window.clearTimeout(timeout);
  }, [toastKey]);

  if (!toastKey || !toastCopy[toastKey] || !visible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        className={cn(
          "glass-card flex items-center gap-3 rounded-full border border-mint-200/80 px-4 py-3 text-sm font-semibold text-foreground shadow-2xl",
          "animate-[toast-in_180ms_ease-out]",
        )}
      >
        <div className="rounded-full bg-mint-100 p-1 text-mint-700">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <span>{toastCopy[toastKey]}</span>
      </div>
    </div>
  );
}
