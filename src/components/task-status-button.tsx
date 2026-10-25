"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { labelForTaskStatus } from "@/lib/utils";
import type { TaskStatus } from "@/lib/types";

const actionLabels: Record<TaskStatus, string> = {
  not_started: "Start", in_progress: "Done", done: "Reopen", blocked: "Unblock",
};

export function TaskStatusButton({ status, title }: { status: TaskStatus; title: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending}
    aria-label={`${actionLabels[status]}: ${title}`}
    className="button-secondary inline-flex min-h-11 flex-wrap items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs disabled:opacity-60">
    <span className="text-muted">{labelForTaskStatus(status)}</span>
    {pending ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />}
    <span className="font-semibold">{pending ? "Saving…" : actionLabels[status]}</span>
  </button>;
}
