"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export function PendingSubmitButton({
  children,
  pendingLabel = "Saving...",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-mint-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-mint-500/25 transition hover:bg-mint-600 disabled:cursor-not-allowed disabled:opacity-70",
        className,
      )}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function PendingGhostButton({
  children,
  pendingLabel = "Working...",
  active = false,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  active?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-70",
        active ? "bg-mint-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
        className,
      )}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function PendingIconButton({
  children,
  pendingLabel = "Moving...",
  disabled,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={cn(
        "rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-35",
        className,
      )}
      title={pending ? pendingLabel : undefined}
    >
      {children}
    </button>
  );
}

export function InlineEditor({
  buttonLabel,
  panelTitle,
  children,
}: {
  buttonLabel: string;
  panelTitle: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-mint-200 bg-mint-50 px-4 py-2 text-sm font-semibold text-mint-700 transition hover:bg-mint-100"
      >
        <Pencil className="h-4 w-4" />
        {buttonLabel}
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-[20px] bg-mint-50/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-mint-700">{panelTitle}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-mint-200 bg-white px-3 py-1.5 text-xs font-semibold text-mint-700"
        >
          Cancel
        </button>
      </div>
      <div
        onSubmit={() => {
          setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ProblemEditor({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InlineEditor buttonLabel="Edit problem detail" panelTitle="Edit problem detail">
      {children}
    </InlineEditor>
  );
}

export function TaskEditor({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InlineEditor buttonLabel="Edit task detail" panelTitle="Edit task detail">
      {children}
    </InlineEditor>
  );
}
