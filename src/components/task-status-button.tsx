"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { labelForTaskStatus, nextTaskCycleStatus } from "@/lib/utils";
import type { TaskStatus, TaskType } from "@/lib/types";

const actionLabels: Record<TaskStatus, string> = {
  not_started: "Start", in_progress: "Done", done: "Reopen", blocked: "Unblock",
};

export function TaskStatusButton({ status, type, title }: { status: TaskStatus; type: TaskType; title: string }) {
  const actionLabel = nextTaskCycleStatus(status, type) === "done" ? "Done" : actionLabels[status];
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending}
    aria-label={`${actionLabel}: ${title}`}
    className="button-secondary inline-flex min-h-11 flex-wrap items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs disabled:opacity-60">
    <span className="text-muted">{labelForTaskStatus(status)}</span>
    {pending ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />}
    <span className="font-semibold">{pending ? "Saving…" : actionLabel}</span>
  </button>;
}
