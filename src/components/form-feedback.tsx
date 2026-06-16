"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Pencil, Plus, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function PendingSubmitButton({
  children,
  pendingLabel = "กำลังบันทึก...",
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
  pendingLabel = "กำลังดำเนินการ...",
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
  pendingLabel = "กำลังย้าย...",
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
  buttonIcon = "edit",
  children,
}: {
  buttonLabel: string;
  panelTitle: string;
  buttonIcon?: "edit" | "create";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const Icon = buttonIcon === "create" ? Plus : Pencil;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-mint-200 bg-mint-50 px-4 py-2 text-sm font-semibold text-mint-700 transition hover:bg-mint-100"
      >
        <Icon className="h-4 w-4" />
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

export function PatientEditor({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InlineEditor buttonLabel="Edit patient detail" panelTitle="Edit patient detail">
      {children}
    </InlineEditor>
  );
}

export function ProblemCreator({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InlineEditor buttonLabel="Create problem" panelTitle="Create problem" buttonIcon="create">
      {children}
    </InlineEditor>
  );
}

export function TaskCreator({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InlineEditor buttonLabel="Create task" panelTitle="Create task" buttonIcon="create">
      {children}
    </InlineEditor>
  );
}

export function DischargeSummaryEditor({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InlineEditor
      buttonLabel="Discharge patient"
      panelTitle="Discharge summary"
      buttonIcon="edit"
    >
      {children}
    </InlineEditor>
  );
}

export function AdminEditor({
  children,
  buttonLabel,
  panelTitle,
}: {
  children: React.ReactNode;
  buttonLabel: string;
  panelTitle: string;
}) {
  return (
    <InlineEditor buttonLabel={buttonLabel} panelTitle={panelTitle} buttonIcon="edit">
      {children}
    </InlineEditor>
  );
}

export function AdminCreator({
  children,
  buttonLabel,
  panelTitle,
}: {
  children: React.ReactNode;
  buttonLabel: string;
  panelTitle: string;
}) {
  return (
    <InlineEditor buttonLabel={buttonLabel} panelTitle={panelTitle} buttonIcon="create">
      {children}
    </InlineEditor>
  );
}

export function DangerZone({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[28px] border border-rose-200/80 bg-rose-50/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-rose-100 p-2 text-rose-700">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-rose-900">{title}</p>
            <p className="mt-1 text-sm text-rose-800/80">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
        >
          {open ? "Hide danger actions" : "Open danger actions"}
        </button>
      </div>
      {open ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function ConfirmDeleteWard({
  wardName,
  children,
}: {
  wardName: string;
  children: React.ReactNode;
}) {
  const [value, setValue] = useState("");
  const confirmed = value.trim() === wardName;

  return (
    <div className="space-y-3 rounded-[20px] border border-rose-200 bg-white/80 p-4">
      <div className="flex items-start gap-2 text-sm text-rose-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Type the ward name to enable delete. This reduces accidental clicks.</p>
      </div>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={wardName}
        className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-500/12"
      />
      <div className={cn("transition", !confirmed && "pointer-events-none opacity-45")}>
        {children}
      </div>
    </div>
  );
}

export function CopyTextButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={cn(
        "rounded-full border border-mint-200 bg-mint-50 px-4 py-2 text-sm font-semibold text-mint-700 transition hover:bg-mint-100",
        className,
      )}
    >
      {copied ? "Copied" : "Copy text"}
    </button>
  );
}
