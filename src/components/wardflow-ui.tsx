import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Clock3,
  Pencil,
  Sparkles,
} from "lucide-react";
import {
  cn,
  formatDateTime,
  formatRelative,
  formatShortTime,
  getInitials,
  labelForRole,
  labelForTaskType,
  priorityTone,
  statusTone,
} from "@/lib/utils";
import {
  PendingGhostButton,
  PendingIconButton,
  PendingSubmitButton,
  ProblemEditor,
} from "@/components/form-feedback";
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
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
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
                  {patient.lifecycle === "discharged" ? (
                    <Pill tone="bg-slate-100 text-slate-600">discharged</Pill>
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
    { label: "Lifecycle", value: patient.lifecycle },
    { label: "Discharged at", value: patient.dischargedAt ? formatDateTime(patient.dischargedAt) : "-" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
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
  saveProblemAction,
  canEdit,
}: {
  problems: Problem[];
  patientId: string;
  reorderAction: (formData: FormData) => Promise<void>;
  saveProblemAction: (formData: FormData) => Promise<void>;
  canEdit: boolean;
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
              {canEdit ? (
                <>
                  <form action={reorderAction}>
                    <input type="hidden" name="patientId" value={patientId} />
                    <input type="hidden" name="problemId" value={problem.id} />
                    <input type="hidden" name="direction" value="up" />
                    <PendingIconButton
                      disabled={index === 0}
                      pendingLabel="Moving..."
                    >
                      <ChevronUp className="h-4 w-4" />
                    </PendingIconButton>
                  </form>
                  <form action={reorderAction}>
                    <input type="hidden" name="patientId" value={patientId} />
                    <input type="hidden" name="problemId" value={problem.id} />
                    <input type="hidden" name="direction" value="down" />
                    <PendingIconButton
                      disabled={index === active.length - 1}
                      pendingLabel="Moving..."
                    >
                      <ChevronDown className="h-4 w-4" />
                    </PendingIconButton>
                  </form>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            <InfoBlock label="Plan" value={problem.plan ?? "-"} />
            <InfoBlock label="Pending" value={problem.pending ?? "-"} />
            <InfoBlock label="Watch out" value={problem.watchOut ?? "-"} />
          </div>

          {canEdit ? (
            <ProblemEditor>
              <form action={saveProblemAction} className="mt-4 space-y-3">
                <input type="hidden" name="id" value={problem.id} />
                <input type="hidden" name="patientId" value={patientId} />
                <Field label="Title">
                  <TextInput name="title" defaultValue={problem.title} required />
                </Field>
                <Field label="Status">
                  <SelectBox name="status" defaultValue={problem.status}>
                    <option value="active">active</option>
                    <option value="improving">improving</option>
                    <option value="worsening">worsening</option>
                    <option value="resolved">resolved</option>
                  </SelectBox>
                </Field>
                <Field label="Key data">
                  <TextArea name="keyData" defaultValue={problem.keyData ?? ""} />
                </Field>
                <Field label="Plan">
                  <TextArea name="plan" defaultValue={problem.plan ?? ""} />
                </Field>
                <Field label="Pending">
                  <TextArea name="pending" defaultValue={problem.pending ?? ""} />
                </Field>
                <Field label="Watch out">
                  <TextArea name="watchOut" defaultValue={problem.watchOut ?? ""} />
                </Field>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" name="includeInHandover" defaultChecked={problem.includeInHandover} />
                  Include in handover
                </label>
                <SubmitButton pendingLabel="Updating problem...">Update problem</SubmitButton>
              </form>
            </ProblemEditor>
          ) : null}
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
  saveTaskAction,
  profiles,
  canEdit,
}: {
  tasks: WardTask[];
  patient: Patient;
  updateStatusAction: (formData: FormData) => Promise<void>;
  saveTaskAction: (formData: FormData) => Promise<void>;
  profiles: UserProfile[];
  canEdit: boolean;
}) {
  const active = tasks.filter((task) => task.status !== "done");
  const archived = tasks.filter((task) => task.status === "done");

  return (
    <div className="space-y-3">
      {active.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          patient={patient}
          updateStatusAction={updateStatusAction}
          saveTaskAction={saveTaskAction}
          profiles={profiles}
          canEdit={canEdit}
        />
      ))}

      {archived.length > 0 ? (
        <details className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">
            Archived done task ({archived.length})
          </summary>
          <div className="mt-3 space-y-3">
            {archived.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                patient={patient}
                updateStatusAction={updateStatusAction}
                saveTaskAction={saveTaskAction}
                profiles={profiles}
                canEdit={canEdit}
                compact
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function TaskCard({
  task,
  patient,
  updateStatusAction,
  saveTaskAction,
  profiles,
  canEdit,
  compact = false,
}: {
  task: WardTask;
  patient: Patient;
  updateStatusAction: (formData: FormData) => Promise<void>;
  saveTaskAction: (formData: FormData) => Promise<void>;
  profiles: UserProfile[];
  canEdit: boolean;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-white/74 p-4">
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
            <PendingGhostButton
              active={task.status === status}
              pendingLabel="Updating..."
            >
              {status.replace("_", " ")}
            </PendingGhostButton>
          </form>
        ))}
      </div>

      {canEdit ? (
        <details className="mt-4 rounded-[20px] bg-mint-50/70 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-mint-700">
            <span className="inline-flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit task detail
            </span>
          </summary>
          <form action={saveTaskAction} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="patientId" value={patient.id} />
            <Field label="Title">
              <TextInput name="title" defaultValue={task.title} required />
            </Field>
            <Field label="Owner">
              <SelectBox name="ownerId" defaultValue={task.ownerId ?? ""}>
                <StaffOptions profiles={profiles} />
              </SelectBox>
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Status">
                <SelectBox name="status" defaultValue={task.status}>
                  <option value="not_started">not_started</option>
                  <option value="in_progress">in_progress</option>
                  <option value="waiting">waiting</option>
                  <option value="done">done</option>
                  <option value="blocked">blocked</option>
                </SelectBox>
              </Field>
              <Field label="Priority">
                <SelectBox name="priority" defaultValue={task.priority}>
                  <option value="low">low</option>
                  <option value="normal">normal</option>
                  <option value="high">high</option>
                  <option value="urgent">urgent</option>
                </SelectBox>
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Type">
                <SelectBox name="type" defaultValue={task.type}>
                  <option value="lab">lab</option>
                  <option value="imaging">imaging</option>
                  <option value="consult">consult</option>
                  <option value="procedure">procedure</option>
                  <option value="family_talk">family_talk</option>
                  <option value="discharge">discharge</option>
                  <option value="medication">medication</option>
                  <option value="other">other</option>
                </SelectBox>
              </Field>
              <Field label="Due time">
                <TextInput name="dueAt" type="datetime-local" defaultValue={toDatetimeLocal(task.dueAt)} />
              </Field>
            </div>
            <Field label="Note">
              <TextArea name="note" defaultValue={task.note ?? ""} />
            </Field>
            <Field label="Blocked reason">
              <TextArea name="blockedReason" defaultValue={task.blockedReason ?? ""} />
            </Field>
            <SubmitButton pendingLabel="Updating task...">Update task</SubmitButton>
          </form>
        </details>
      ) : null}

      {!compact ? (
        <p className="mt-4 text-xs text-muted">
          Updated by {task.updatedByName ?? "Unknown"} · {formatRelative(task.updatedAt)}
        </p>
      ) : null}
    </div>
  );
}

export function Timeline({ items }: { items: ActivityLog[] }) {
  const initialItems = items.slice(0, 4);
  const remainingItems = items.slice(4);

  return (
    <div className="space-y-4">
      {initialItems.map((item) => (
        <TimelineRow key={item.id} item={item} />
      ))}
      {remainingItems.length > 0 ? (
        <details className="rounded-[24px] bg-slate-50/70 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">
            Expand timeline ({remainingItems.length} more)
          </summary>
          <div className="mt-3 space-y-3">
            {remainingItems.map((item) => (
              <TimelineRow key={item.id} item={item} compact />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function TimelineRow({ item, compact = false }: { item: ActivityLog; compact?: boolean }) {
  return (
    <div className={cn("flex gap-3 rounded-[24px] bg-white/74 p-4", compact && "p-3")}>
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-mint-500/12 text-sm font-semibold text-mint-700">
        {getInitials(item.actorName)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{item.actorName}</p>
          <p className="text-[11px] text-muted">{formatDateTime(item.createdAt)}</p>
        </div>
        <p className="mt-1 text-sm text-muted">{item.action}</p>
      </div>
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
                      <h3 className="mt-1 text-lg font-semibold text-foreground">{patient.diagnosis}</h3>
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
                      items={[patient.handover?.escalationInstruction ?? "No manual escalation note yet."]}
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

export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  return <PendingSubmitButton pendingLabel={pendingLabel}>{children}</PendingSubmitButton>;
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
          {profile.name} ({labelForRole(profile.role)})
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

export function StaffRoleCards({
  profiles,
  updateUserRoleAction,
}: {
  profiles: UserProfile[];
  updateUserRoleAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {profiles.map((profile) => (
        <div key={profile.id} className="rounded-[24px] bg-white/74 p-4">
          <p className="font-semibold text-foreground">{profile.name}</p>
          <p className="mt-1 text-sm text-muted">{profile.email}</p>
          <form action={updateUserRoleAction} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="userId" value={profile.id} />
            <Field label="Role">
              <SelectBox name="role" defaultValue={profile.role} className="min-w-44">
                <option value="admin">Admin</option>
                <option value="resident">Residence</option>
                <option value="student">Student</option>
              </SelectBox>
            </Field>
            <SubmitButton>Update role</SubmitButton>
          </form>
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

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}
