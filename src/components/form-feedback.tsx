"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, Pencil, Plus, ShieldAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function PendingSubmitButton({
  children,
  pendingLabel = "กำลังบันทึก...",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={pending}
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-mint-600 bg-mint-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-mint-700 disabled:cursor-not-allowed disabled:opacity-70",
        className,
      )}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export function ConfirmingSubmitButton({
  children,
  confirmMessage,
  pendingLabel = "กำลังดำเนินการ...",
  className,
}: {
  children: React.ReactNode;
  confirmMessage: string;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={(event) => {
        if (pending) {
          return;
        }

        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-rose-700 bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-70",
        className,
      )}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
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
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-70",
        active
          ? "border-mint-600 bg-mint-600 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        className,
      )}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
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
        "rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35",
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
  className,
  buttonClassName,
  panelClassName,
  headerClassName,
  contentClassName,
}: {
  buttonLabel: string;
  panelTitle: string;
  buttonIcon?: "edit" | "create";
  children: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const Icon = buttonIcon === "create" ? Plus : Pencil;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "mt-4 inline-flex items-center gap-2 rounded-full border border-mint-200 bg-white px-4 py-2.5 text-sm font-semibold text-mint-700 transition hover:bg-mint-50 md:px-4",
          className,
          buttonClassName,
        )}
      >
        <Icon className="h-4 w-4" />
        {buttonLabel}
      </button>
    );
  }

  return (
    <div className={cn("mt-4 rounded-[24px] border clinical-divider bg-mint-50/65 p-4", className, panelClassName)}>
      <div className={cn("mb-4 flex items-center justify-between gap-3 border-b clinical-divider pb-3", headerClassName)}>
        <p className="text-sm font-semibold text-mint-700">{panelTitle}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-mint-200 bg-white px-3 py-1.5 text-xs font-semibold text-mint-700 transition hover:bg-mint-50"
        >
          Cancel
        </button>
      </div>
      <div
        className={contentClassName}
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
  className,
  buttonClassName,
  panelClassName,
  headerClassName,
  contentClassName,
}: {
  children: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <InlineEditor
      buttonLabel="Edit patient detail"
      panelTitle="Edit patient detail"
      className={className}
      buttonClassName={buttonClassName}
      panelClassName={panelClassName}
      headerClassName={headerClassName}
      contentClassName={contentClassName}
    >
      {children}
    </InlineEditor>
  );
}

export function ProblemCreator({
  children,
  className,
  buttonClassName,
  panelClassName,
  headerClassName,
  contentClassName,
}: {
  children: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <InlineEditor
      buttonLabel="Create problem"
      panelTitle="Create problem"
      buttonIcon="create"
      className={className}
      buttonClassName={buttonClassName}
      panelClassName={panelClassName}
      headerClassName={headerClassName}
      contentClassName={contentClassName}
    >
      {children}
    </InlineEditor>
  );
}

export function TaskCreator({
  children,
  className,
  buttonClassName,
  panelClassName,
  headerClassName,
  contentClassName,
}: {
  children: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <InlineEditor
      buttonLabel="Create task"
      panelTitle="Create task"
      buttonIcon="create"
      className={className}
      buttonClassName={buttonClassName}
      panelClassName={panelClassName}
      headerClassName={headerClassName}
      contentClassName={contentClassName}
    >
      {children}
    </InlineEditor>
  );
}

export function AdmitPatientCreator({
  children,
  className,
  buttonClassName,
  panelClassName,
  headerClassName,
  contentClassName,
}: {
  children: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <InlineEditor
      buttonLabel="Admit patient"
      panelTitle="Admit patient"
      buttonIcon="create"
      className={className}
      buttonClassName={buttonClassName}
      panelClassName={panelClassName}
      headerClassName={headerClassName}
      contentClassName={contentClassName}
    >
      {children}
    </InlineEditor>
  );
}

export function DischargeSummaryEditor({
  children,
  className,
  buttonClassName,
  panelClassName,
  headerClassName,
  contentClassName,
}: {
  children: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className={cn("mt-3 flex justify-stretch md:mt-5 md:justify-end", className)}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-200 md:w-auto md:px-5 md:py-3",
            buttonClassName,
          )}
        >
          <TriangleAlert className="h-4 w-4" />
          Discharge patient
        </button>
      </div>
    );
  }

  return (
    <div className={cn("mt-5 rounded-[24px] border border-amber-200 bg-amber-50/80 p-4", className, panelClassName)}>
      <div className={cn("mb-4 flex items-center justify-between gap-3 border-b border-amber-200 pb-3", headerClassName)}>
        <p className="text-sm font-semibold text-amber-700">Discharge summary</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
        >
          Cancel
        </button>
      </div>
      <div
        className={contentClassName}
        onSubmit={() => {
          setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
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
    <div className="rounded-[28px] border border-rose-200/80 bg-rose-50/80 p-5">
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
          className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
        >
          {open ? "Hide danger actions" : "Open danger actions"}
        </button>
      </div>
      {open ? <div className="mt-4">{children}</div> : null}
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
        "rounded-full border border-mint-200 bg-white px-4 py-2 text-sm font-semibold text-mint-700 transition hover:bg-mint-50",
        className,
      )}
    >
      {copied ? "Copied" : "Copy text"}
    </button>
  );
}
