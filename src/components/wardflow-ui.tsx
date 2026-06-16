import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Clock3,
  Sparkles,
} from "lucide-react";
import {
  cn,
  formatDateTime,
  formatRelative,
  formatShortTime,
  getInitials,
  labelForTaskType,
  priorityTone,
  statusTone,
} from "@/lib/utils";
import type {
  ActivityLog,
  HandoverBundle,
  Patient,
  Problem,
  TaskTemplate,
  UserProfile,
  WardSummary,
  WardTask,
} from "@/lib/types";

export function GlassPanel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("glass-card rounded-[32px] p-5 md:p-6", className)}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted">
      <Sparkles className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

export function Pill({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        tone ?? "bg-white/80 text-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function PatientCensus({ summaries }: { summaries: WardSummary[] }) {
  return (
    <div className="space-y-6">
      {summaries.map((summary) => (
        <GlassPanel
          key={summary.ward.id}
          title={summary.ward.name}
          subtitle={`${summary.patients.length} patients`}
          action={<Pill tone="bg-mint-500/15 text-mint-700">{summary.patients.length} census</Pill>}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {summary.patients.map((patient) => (
              <Link
                key={patient.id}
                href={`/patients/${patient.id}`}
                className="group rounded-[28px] border border-white/70 bg-white/72 p-4 shadow-lg shadow-emerald-950/5 transition hover:-translate-y-0.5 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted">Bed {patient.bed}</p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">{patient.displayName}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{patient.diagnosis}</p>
                  </div>
                  <div className="rounded-2xl bg-mint-50 p-2 text-mint-700">
                    <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Pill tone={statusTone(patient.status)}>{patient.status}</Pill>
                  <Pill tone="bg-amber-100 text-amber-700">{patient.pendingTaskCount} pending</Pill>
                  {patient.blockedTaskCount > 0 ? (
                    <Pill tone="bg-rose-100 text-rose-700">{patient.blockedTaskCount} blocked</Pill>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-muted">
                  <span>{patient.responsibleDoctorName ?? "Unassigned"}</span>
                  <span>{formatRelative(patient.lastUpdate)}</span>
                </div>
              </Link>
            ))}
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}

export function SummaryGrid({ patient, ward }: { patient: Patient; ward: string | null }) {
  const items = [
    { label: "Ward", value: ward ?? "-" },
    { label: "Bed", value: patient.bed },
    { label: "Diagnosis", value: patient.diagnosis },
    { label: "Responsible", value: patient.responsibleDoctorName ?? "Unassigned" },
    { label: "Status", value: patient.status },
    { label: "Allergy", value: patient.allergy ?? "-" },
    { label: "Isolation", value: patient.isolationFlag ? "Yes" : "No" },
    { label: "Code status", value: patient.codeStatus ?? "-" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-[24px] bg-white/78 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">{item.label}</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function ProblemCards({
  problems,
  patientId,
  reorderAction,
}: {
  problems: Problem[];
  patientId: string;
  reorderAction: (formData: FormData) => Promise<void>;
}) {
  const active = problems.filter((problem) => problem.status !== "resolved");
  const resolved = problems.filter((problem) => problem.status === "resolved");

  return (
    <div className="space-y-4">
      {active.map((problem, index) => (
        <div key={problem.id} className="rounded-[24px] border border-white/70 bg-white/74 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-foreground">{problem.title}</p>
                <Pill tone={statusTone(problem.status)}>{problem.status}</Pill>
              </div>
              <p className="mt-2 text-sm text-muted">{problem.keyData ?? "No key data yet."}</p>
            </div>
            <div className="flex items-center gap-2">
              <form action={reorderAction}>
                <input type="hidden" name="patientId" value={patientId} />
                <input type="hidden" name="problemId" value={problem.id} />
                <input type="hidden" name="direction" value="up" />
                <button
                  type="submit"
                  disabled={index === 0}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-35"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              </form>
              <form action={reorderAction}>
                <input type="hidden" name="patientId" value={patientId} />
                <input type="hidden" name="problemId" value={problem.id} />
                <input type="hidden" name="direction" value="down" />
                <button
                  type="submit"
                  disabled={index === active.length - 1}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-35"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InfoBlock label="Plan" value={problem.plan ?? "-"} />
            <InfoBlock label="Pending" value={problem.pending ?? "-"} />
            <InfoBlock label="Watch out" value={problem.watchOut ?? "-"} />
          </div>
        </div>
      ))}

      {resolved.length > 0 ? (
        <details className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">
            Resolved problems ({resolved.length})
          </summary>
          <div className="mt-3 space-y-3">
            {resolved.map((problem) => (
              <div key={problem.id} className="rounded-2xl bg-white/75 p-3">
                <div className="flex items-center gap-2">
                  <Pill tone={statusTone(problem.status)}>{problem.status}</Pill>
                  <p className="text-sm font-semibold text-slate-700">{problem.title}</p>
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function TaskCards({
  tasks,
  patient,
  updateStatusAction,
}: {
  tasks: WardTask[];
  patient: Patient;
  updateStatusAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div key={task.id} className="rounded-[24px] border border-white/70 bg-white/74 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-foreground">{task.title}</p>
                <Pill tone={statusTone(task.status)}>{task.status}</Pill>
                <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
                <Pill tone="bg-sky-100 text-sky-700">{labelForTaskType(task.type)}</Pill>
              </div>
              <p className="mt-2 text-sm text-muted">{task.note ?? "No note"}</p>
            </div>
            <div className="text-right text-sm text-muted">
              <p>{task.ownerName ?? "Unassigned"}</p>
              <p>{task.dueAt ? `Due ${formatShortTime(task.dueAt)}` : "No due time"}</p>
            </div>
          </div>

          {task.blockedReason ? (
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4" />
              {task.blockedReason}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {["not_started", "in_progress", "waiting", "done", "blocked"].map((status) => (
              <form action={updateStatusAction} key={status}>
                <input type="hidden" name="patientId" value={patient.id} />
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="status" value={status} />
                <button
                  type="submit"
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    task.status === status
                      ? "bg-mint-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {status.replace("_", " ")}
                </button>
              </form>
            ))}
          </div>

          <p className="mt-4 text-xs text-muted">
            Updated by {task.updatedByName ?? "Unknown"} · {formatRelative(task.updatedAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function Timeline({ items }: { items: ActivityLog[] }) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3 rounded-[24px] bg-white/74 p-4">
          <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-mint-500/12 text-sm font-semibold text-mint-700">
            {getInitials(item.actorName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-foreground">{item.actorName}</p>
              <p className="text-xs text-muted">{formatDateTime(item.createdAt)}</p>
            </div>
            <p className="mt-1 text-sm text-muted">{item.action}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HandoverCards({ bundles }: { bundles: HandoverBundle[] }) {
  return (
    <div className="space-y-6">
      {bundles.map((bundle) => (
        <GlassPanel
          key={bundle.ward.id}
          title={bundle.ward.name}
          subtitle="Critical first, watch second, pending and blocked next."
        >
          <div className="space-y-4">
            {bundle.patients
              .filter(
                (patient) =>
                  patient.status !== "stable" ||
                  patient.tasks.some((task) => task.status !== "done") ||
                  patient.problems.some((problem) => problem.watchOut || problem.pending),
              )
              .map((patient) => (
                <div key={patient.id} className="rounded-[28px] border border-white/70 bg-white/74 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-muted">Bed {patient.bed}</p>
                      <h3 className="mt-1 text-lg font-semibold text-foreground">
                        {patient.diagnosis}
                      </h3>
                    </div>
                    <Pill tone={statusTone(patient.status)}>{patient.status}</Pill>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <MiniList
                      title="Watch"
                      items={patient.problems
                        .map((problem) => problem.watchOut)
                        .filter((value): value is string => Boolean(value))}
                    />
                    <MiniList
                      title="Pending"
                      items={[
                        ...patient.problems
                          .map((problem) => problem.pending)
                          .filter((value): value is string => Boolean(value)),
                        ...patient.tasks.map((task) => task.title),
                      ]}
                    />
                    <MiniList
                      title="Escalation"
                      items={[
                        patient.handover?.escalationInstruction ?? "No manual escalation note yet.",
                      ]}
                    />
                  </div>
                </div>
              ))}
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}

export function TaskInbox({ items }: { items: Array<{ task: WardTask; patient: Patient }> }) {
  return (
    <div className="space-y-3">
      {items.map(({ task, patient }) => (
        <div key={task.id} className="rounded-[24px] border border-white/70 bg-white/74 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-foreground">{task.title}</p>
                <Pill tone={statusTone(task.status)}>{task.status}</Pill>
                <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
              </div>
              <p className="mt-1 text-sm text-muted">
                Bed {patient.bed} · {patient.displayName} · {patient.diagnosis}
              </p>
            </div>
            <div className="text-right text-xs text-muted">
              <p>{task.ownerName ?? "Unassigned"}</p>
              <p>{task.dueAt ? formatDateTime(task.dueAt) : "No due time"}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-foreground">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-muted">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-mint-400 focus:ring-4 focus:ring-mint-500/12",
        props.className,
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-24 w-full rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-mint-400 focus:ring-4 focus:ring-mint-500/12",
        props.className,
      )}
    />
  );
}

export function SelectBox(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-mint-400 focus:ring-4 focus:ring-mint-500/12",
        props.className,
      )}
    />
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="inline-flex items-center justify-center rounded-full bg-mint-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-mint-500/25 transition hover:bg-mint-600"
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/80 bg-white/60 p-8 text-center">
      <Clock3 className="mx-auto h-8 w-8 text-muted" />
      <h3 className="mt-3 font-display text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}

export function SetupNotice({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 leading-6">{body}</p>
    </div>
  );
}

export function StaffOptions({ profiles }: { profiles: UserProfile[] }) {
  return (
    <>
      <option value="">Unassigned</option>
      {profiles.map((profile) => (
        <option key={profile.id} value={profile.id}>
          {profile.name} ({profile.role})
        </option>
      ))}
    </>
  );
}

export function TemplateCards({ templates }: { templates: TaskTemplate[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => (
        <div key={template.id} className="rounded-[24px] bg-white/74 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{template.title}</p>
            <Pill tone="bg-sky-100 text-sky-700">{labelForTaskType(template.type)}</Pill>
          </div>
          <p className="mt-3 text-sm text-muted">Default priority: {template.defaultPriority}</p>
        </div>
      ))}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-mint-50/70 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[24px] bg-mint-50/80 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <p key={`${title}-${item}`} className="text-sm font-medium text-foreground">
              {item}
            </p>
          ))
        ) : (
          <p className="text-sm text-muted">None</p>
        )}
      </div>
    </div>
  );
}
