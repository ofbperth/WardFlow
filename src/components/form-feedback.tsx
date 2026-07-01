"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, Pencil, Plus, ShieldAlert, TriangleAlert, X } from "lucide-react";
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
        "button-accent inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-70",
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
        "inline-flex items-center justify-center rounded-full border border-[color:var(--color-danger)] bg-[color:var(--color-danger)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-70",
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
          ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-white"
          : "button-secondary text-[color:var(--color-ink-2)]",
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
        "button-secondary rounded-full px-3 py-2 text-xs font-semibold text-[color:var(--color-ink-2)] disabled:cursor-not-allowed disabled:opacity-35",
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
  iconOnly = false,
  compactTrigger = false,
  buttonTitle,
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
  iconOnly?: boolean;
  compactTrigger?: boolean;
  buttonTitle?: string;
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
        title={buttonTitle ?? buttonLabel}
        aria-label={buttonTitle ?? buttonLabel}
        className={cn(
          iconOnly
            ? cn(
                "button-secondary inline-flex items-center justify-center rounded-full text-[color:var(--color-accent-strong)]",
                compactTrigger ? "h-7 w-7" : "h-8 w-8",
              )
            : cn(
                "button-secondary mt-4 inline-flex items-center gap-2 rounded-full text-sm font-semibold text-[color:var(--color-accent-strong)] md:px-4",
                compactTrigger ? "px-3 py-2" : "px-4 py-2.5",
              ),
          className,
          buttonClassName,
        )}
      >
        <Icon className="h-4 w-4" />
        {iconOnly ? <span className="sr-only">{buttonLabel}</span> : buttonLabel}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--color-ink)]/28 p-0 md:items-center md:px-4 md:py-6",
        className,
      )}
      onClick={() => setOpen(false)}
    >
      <div
        className={cn(
          "panel-accent w-full max-h-[88vh] overflow-y-auto rounded-t-[24px] border-x clinical-divider p-4 shadow-2xl md:max-h-[calc(100vh-3rem)] md:max-w-2xl md:rounded-[24px] md:border md:p-5",
          panelClassName,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex justify-center md:hidden">
          <span className="h-1 w-10 rounded-full bg-[color:var(--color-rule)]" />
        </div>
        <div
          className={cn(
            "mb-4 flex items-center justify-between gap-3 border-b clinical-divider pb-3",
            headerClassName,
          )}
        >
          <p className="text-sm font-semibold text-[color:var(--color-accent-strong)]">{panelTitle}</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="button-secondary inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--color-accent-strong)]"
          >
            <X className="h-4 w-4" />
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
    </div>
  );
}

export function ProblemEditor({
  children,
  iconOnly,
  compactTrigger,
  buttonTitle,
}: {
  children: React.ReactNode;
  iconOnly?: boolean;
  compactTrigger?: boolean;
  buttonTitle?: string;
}) {
  return (
    <InlineEditor
      buttonLabel="Edit problem detail"
      panelTitle="Edit problem detail"
      iconOnly={iconOnly}
      compactTrigger={compactTrigger}
      buttonTitle={buttonTitle}
    >
      {children}
    </InlineEditor>
  );
}

export function ProgressEntryEditor({
  children,
  iconOnly,
  compactTrigger,
  buttonTitle,
}: {
  children: React.ReactNode;
  iconOnly?: boolean;
  compactTrigger?: boolean;
  buttonTitle?: string;
}) {
  return (
    <InlineEditor
      buttonLabel="Add progress update"
      panelTitle="Add progress update"
      buttonIcon="create"
      iconOnly={iconOnly}
      compactTrigger={compactTrigger}
      buttonTitle={buttonTitle}
    >
      {children}
    </InlineEditor>
  );
}

export function ProgressEntryHistoryEditor({
  children,
  iconOnly,
  compactTrigger,
  buttonTitle,
}: {
  children: React.ReactNode;
  iconOnly?: boolean;
  compactTrigger?: boolean;
  buttonTitle?: string;
}) {
  return (
    <InlineEditor
      buttonLabel="Edit progress update"
      panelTitle="Edit progress update"
      buttonIcon="edit"
      iconOnly={iconOnly}
      compactTrigger={compactTrigger}
      buttonTitle={buttonTitle}
    >
      {children}
    </InlineEditor>
  );
}

export function TaskEditor({
  children,
  iconOnly,
  compactTrigger,
  buttonTitle,
}: {
  children: React.ReactNode;
  iconOnly?: boolean;
  compactTrigger?: boolean;
  buttonTitle?: string;
}) {
  return (
    <InlineEditor
      buttonLabel="Edit task detail"
      panelTitle="Edit task detail"
      iconOnly={iconOnly}
      compactTrigger={compactTrigger}
      buttonTitle={buttonTitle}
    >
      {children}
    </InlineEditor>
  );
}

export function PatientEditor({
  children,
  iconOnly = false,
  compactTrigger = false,
  buttonTitle,
  className,
  buttonClassName,
  panelClassName,
  headerClassName,
  contentClassName,
}: {
  children: React.ReactNode;
  iconOnly?: boolean;
  compactTrigger?: boolean;
  buttonTitle?: string;
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
      iconOnly={iconOnly}
      compactTrigger={compactTrigger}
      buttonTitle={buttonTitle}
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
  buttonLabel = "Create problem",
  iconOnly = false,
  compactTrigger = false,
  buttonTitle,
  className,
  buttonClassName,
  panelClassName,
  headerClassName,
  contentClassName,
}: {
  children: React.ReactNode;
  buttonLabel?: string;
  iconOnly?: boolean;
  compactTrigger?: boolean;
  buttonTitle?: string;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <InlineEditor
      buttonLabel={buttonLabel}
      panelTitle="Create problem"
      buttonIcon="create"
      iconOnly={iconOnly}
      compactTrigger={compactTrigger}
      buttonTitle={buttonTitle}
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
  buttonLabel = "Create task",
  iconOnly = false,
  compactTrigger = false,
  buttonTitle,
  className,
  buttonClassName,
  panelClassName,
  headerClassName,
  contentClassName,
}: {
  children: React.ReactNode;
  buttonLabel?: string;
  iconOnly?: boolean;
  compactTrigger?: boolean;
  buttonTitle?: string;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <InlineEditor
      buttonLabel={buttonLabel}
      panelTitle="Create task"
      buttonIcon="create"
      iconOnly={iconOnly}
      compactTrigger={compactTrigger}
      buttonTitle={buttonTitle}
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
  iconOnly = false,
  compactTrigger = false,
  buttonTitle,
  className,
  buttonClassName,
  panelClassName,
  headerClassName,
  contentClassName,
}: {
  children: React.ReactNode;
  iconOnly?: boolean;
  compactTrigger?: boolean;
  buttonTitle?: string;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div
        className={cn(
          iconOnly ? "inline-flex items-center" : "mt-3 flex justify-stretch md:mt-5 md:justify-end",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={buttonTitle ?? "Discharge patient"}
          aria-label={buttonTitle ?? "Discharge patient"}
          className={cn(
            iconOnly
              ? cn(
                  "inline-flex items-center justify-center rounded-full border border-[color:var(--color-warning)] bg-[color:var(--color-warning)]/15 text-[color:var(--color-ink)]",
                  compactTrigger ? "h-7 w-7" : "h-8 w-8",
                )
              : "inline-flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--color-warning)] bg-[color:var(--color-warning)]/15 px-4 py-2.5 text-sm font-semibold text-[color:var(--color-ink)] md:w-auto md:px-5 md:py-3",
            buttonClassName,
          )}
        >
          <TriangleAlert className="h-4 w-4" />
          {iconOnly ? <span className="sr-only">Discharge patient</span> : "Discharge patient"}
        </button>
      </div>
    );
  }

  return (
    <div className={cn("mt-5 rounded-[24px] border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 p-4", className, panelClassName)}>
      <div className={cn("mb-4 flex items-center justify-between gap-3 border-b border-[color:var(--color-warning)]/35 pb-3", headerClassName)}>
        <p className="text-sm font-semibold text-[color:var(--color-ink)]">Discharge summary</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="button-secondary rounded-full px-3 py-1.5 text-xs font-semibold"
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
    <div className="rounded-[28px] border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-soft)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white p-2 text-[color:var(--color-danger)]">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-[color:var(--color-ink)]">{title}</p>
            <p className="mt-1 text-sm text-[color:var(--color-ink-2)]">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="button-danger rounded-full px-4 py-2 text-sm font-semibold"
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
        "button-secondary rounded-full px-4 py-2 text-sm font-semibold text-[color:var(--color-accent-strong)]",
        className,
      )}
    >
      {copied ? "Copied" : "Copy text"}
    </button>
  );
}
