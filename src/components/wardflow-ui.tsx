import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  ChevronDown,
  Clock3,
  Cross,
} from "lucide-react";
import {
  cn,
  formatDateTime,
  formatRelative,
  getInitials,
  labelForActivityAction,
  labelForLifecycle,
  labelForProblemPriority,
  labelForPatientStatus,
  labelForPrecaution,
  labelForRole,
  labelForTaskPriority,
  labelForTaskStatus,
  labelForTaskType,
  problemPriorityTone,
  priorityTone,
  statusTone,
} from "@/lib/utils";
import {
  AdminEditor,
  ConfirmingSubmitButton,
  CopyTextButton,
  DangerZone,
  PendingGhostButton,
  PendingSubmitButton,
  ProblemEditor,
  TaskCreator,
  TaskEditor,
} from "@/components/form-feedback";
import type {
  ActivityLog,
  DischargedDirectoryItem,
  HandoverBundle,
  Patient,
  Problem,
  TaskTemplate,
  Ward,
  WardTask,
  TaskWithUpdates,
  UserProfile,
  WardSummary,
} from "@/lib/types";

export function GlassPanel({
  title,
  subtitle,
  action,
  children,
  headingLevel = 2,
  className,
  headerClassName,
  titleBlockClassName,
  actionClassName,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  headingLevel?: 1 | 2 | 3;
  className?: string;
  headerClassName?: string;
  titleBlockClassName?: string;
  actionClassName?: string;
}) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";

  return (
    <section className={cn("app-panel rounded-[28px] p-4 md:p-6", className)}>
      <div
        className={cn(
          "mb-4 flex items-start justify-between gap-4 border-b clinical-divider pb-4 md:mb-5",
          headerClassName,
        )}
      >
        <div className={cn("min-w-0", titleBlockClassName)}>
          <HeadingTag
            className={cn(
              "font-display font-semibold text-foreground text-balance",
              headingLevel === 1 ? "text-[1.95rem] md:text-[2.35rem]" : "text-xl md:text-[1.55rem]",
            )}
          >
            {title}
          </HeadingTag>
          {subtitle ? (
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[color:var(--color-ink-2)]">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className={cn("shrink-0", actionClassName)}>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
      <Cross className="h-3.5 w-3.5 text-[color:var(--color-accent)]" />
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("app-panel rounded-[28px] px-4 py-5 md:px-6 md:py-6", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 max-w-4xl">
          <h1 className="font-display text-[1.95rem] font-semibold text-foreground text-balance md:text-[2.35rem]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-2)]">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}

export function ExpandableFilters({
  title = "Filters",
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details
      className={cn(
        "panel-muted mb-5 rounded-[22px] p-3.5",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[18px] bg-white px-4 py-3 text-sm font-semibold text-foreground marker:content-none">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 text-[color:var(--color-ink-2)] transition-transform details-open:rotate-180" />
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}

export function Pill({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold",
        tone ?? "border-[color:var(--color-rule)] bg-white text-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function PatientCensus({
  summaries,
  renderWardFooter,
}: {
  summaries: WardSummary[];
  renderWardFooter?: (summary: WardSummary) => React.ReactNode;
}) {
  return (
    <div className="space-y-4 md:space-y-5">
      {summaries.map((summary) => (
        <GlassPanel
          key={summary.ward.id}
          title={summary.ward.name}
          action={
            <Pill tone="border-[color:var(--color-rule)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-strong)]">
              {summary.patients.length} ราย
            </Pill>
          }
          className="rounded-[28px] px-4 py-4 md:px-6 md:py-6"
        >
          <div className="grid gap-2.5 md:grid-cols-2 xl:gap-3 2xl:grid-cols-3">
            {summary.patients.map((patient) => (
              <Link
                key={patient.id}
                href={`/patients/${patient.id}`}
                className="group rounded-[20px] border clinical-divider bg-white p-3.5 shadow-sm transition hover:border-[color:var(--color-accent)]/30 hover:bg-[color:var(--color-accent-soft)]/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        Bed {patient.bed}
                      </p>
                      {patient.highestPriorityProblem ? (
                        <Pill tone={problemPriorityTone(patient.highestPriorityProblem.priority)}>
                          {labelForProblemPriority(patient.highestPriorityProblem.priority)}
                        </Pill>
                      ) : (
                        <Pill tone={statusTone(patient.status)}>{labelForPatientStatus(patient.status)}</Pill>
                      )}
                    </div>
                    <h3 className="mt-1.5 line-clamp-1 text-base font-semibold text-foreground">
                      {patient.displayName}
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      {patient.age ?? "-"} y / {patient.sex ?? "-"}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-5 text-foreground/90">
                      {patient.diagnosis}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted">
                      {patient.highestPriorityProblem
                        ? `${patient.highestPriorityProblem.title} | ${
                            patient.highestPriorityProblem.currentStatus ?? "No status line"
                          }`
                        : "No active problem flagged"}
                    </p>
                  </div>
                  <div className="rounded-full border clinical-divider bg-[color:var(--color-accent-soft)] p-2 text-[color:var(--color-accent-strong)]">
                    <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="border-[color:var(--color-warning)]/35 bg-[color:var(--color-warning)]/12 text-[color:var(--color-ink)]">
                    {patient.pendingTaskCount} open task
                  </Pill>
                  {patient.urgentTaskCount > 0 ? (
                    <Pill tone="border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]">
                      {patient.urgentTaskCount} urgent task
                    </Pill>
                  ) : null}
                  {patient.overdueTaskCount > 0 ? (
                    <Pill tone="border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]">
                      {patient.overdueTaskCount} overdue
                    </Pill>
                  ) : null}
                  {patient.blockedTaskCount > 0 ? (
                    <Pill tone="border-[color:var(--color-warning)]/35 bg-[color:var(--color-warning)]/12 text-[color:var(--color-ink)]">
                      {patient.blockedTaskCount} blocked
                    </Pill>
                  ) : null}
                  {patient.lifecycle === "discharged" ? (
                    <Pill tone="border-[color:var(--color-rule)] bg-[color:var(--color-paper-3)] text-[color:var(--color-ink-2)]">
                      Discharged
                    </Pill>
                  ) : null}
                </div>

                <div className="mt-3 border-t clinical-divider pt-2.5 text-xs text-muted">
                  <span className="line-clamp-1">Responsible: {patient.responsibleDoctorName ?? "Unassigned"}</span>
                </div>
              </Link>
            ))}
          </div>
          {renderWardFooter ? (
            <div className="mt-4 flex justify-end border-t clinical-divider pt-4">
              {renderWardFooter(summary)}
            </div>
          ) : null}
        </GlassPanel>
      ))}
    </div>
  );
}

export function SummaryGrid({ patient, ward }: { patient: Patient; ward: string | null }) {
  const primaryItems = [
    { label: "Ward", value: ward ?? "-" },
    { label: "Bed", value: patient.bed },
    { label: "Diagnosis", value: patient.diagnosis },
    { label: "Responsible", value: patient.responsibleDoctorName ?? "Unassigned" },
    { label: "Status", value: labelForPatientStatus(patient.status) },
  ];
  const secondaryItems = [
    { label: "Precaution", value: labelForPrecaution(patient.precaution) },
    { label: "Allergy", value: patient.allergy ?? "-" },
    { label: "Lifecycle", value: labelForLifecycle(patient.lifecycle) },
    { label: "Discharged at", value: patient.dischargedAt ? formatDateTime(patient.dischargedAt) : "-" },
  ];
  const allItems = [...primaryItems, ...secondaryItems];

  return (
    <>
      <div className="grid gap-2.5 sm:grid-cols-2 md:hidden">
        {primaryItems.map((item) => (
          <div
            key={item.label}
            className={cn(
              "rounded-[20px] border clinical-divider bg-white p-3.5",
              item.label === "Diagnosis" ? "sm:col-span-2" : "",
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{item.label}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-foreground">{item.value}</p>
          </div>
        ))}

        <details className="panel-muted sm:col-span-2 rounded-[20px] p-3.5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--color-ink)]">
            Clinical details
          </summary>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {secondaryItems.map((item) => (
              <div key={item.label} className="rounded-[18px] border clinical-divider bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{item.label}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {allItems.map((item) => (
          <div key={item.label} className="rounded-[20px] border clinical-divider bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{item.label}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-foreground">{item.value}</p>
          </div>
        ))}
      </div>
    </>
  );
}

export function ProblemCards({
  problems,
  tasks,
  patientId,
  reorderAction,
  saveProblemAction,
  saveTaskAction,
  updateStatusAction,
  profiles,
  templates,
  defaultTaskOwnerId,
  canEdit,
}: {
  problems: Problem[];
  tasks: TaskWithUpdates[];
  patientId: string;
  reorderAction: (formData: FormData) => Promise<void>;
  saveProblemAction: (formData: FormData) => Promise<void>;
  saveTaskAction: (formData: FormData) => Promise<void>;
  updateStatusAction: (formData: FormData) => Promise<void>;
  profiles: UserProfile[];
  templates: TaskTemplate[];
  defaultTaskOwnerId: string;
  canEdit: boolean;
}) {
  void reorderAction;
  const active = problems.filter((problem) => problem.priority !== "RESOLVED_CHRONIC");
  const resolved = problems.filter((problem) => problem.priority === "RESOLVED_CHRONIC");
  const tasksByProblem = new Map<string, TaskWithUpdates[]>();

  for (const task of tasks) {
    if (!task.problemId) continue;
    const current = tasksByProblem.get(task.problemId) ?? [];
    current.push(task);
    tasksByProblem.set(task.problemId, current);
  }

  return (
    <div className="space-y-3">
      {active.map((problem) => {
        const linkedTasks = [...(tasksByProblem.get(problem.id) ?? [])].sort((left, right) => {
          if (left.status === "done" && right.status !== "done") return 1;
          if (left.status !== "done" && right.status === "done") return -1;
          return right.updatedAt.localeCompare(left.updatedAt);
        });
        const incompleteCount = linkedTasks.filter((task) => task.status !== "done").length;
        const defaultOpen =
          problem.priority === "ACTIVE_UNSTABLE" ||
          linkedTasks.some((task) => task.status !== "done" && task.priority !== "normal");

        return (
          <details
            key={problem.id}
            open={defaultOpen}
            className="rounded-[22px] border clinical-divider bg-white p-3.5 md:p-4"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 marker:content-none">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={problemPriorityTone(problem.priority)}>
                    {labelForProblemPriority(problem.priority)}
                  </Pill>
                  <p className="text-base font-semibold text-foreground">{problem.title}</p>
                  <Pill tone="border-[color:var(--color-rule)] bg-[color:var(--color-paper-3)] text-[color:var(--color-ink)]">
                    {incompleteCount} task
                  </Pill>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted">
                  {problem.currentStatus ?? problem.keyData ?? "No status line yet"}
                </p>
              </div>
              <ChevronDown className="mt-1 h-4 w-4 text-[color:var(--color-ink-2)] transition-transform details-open:rotate-180" />
            </summary>

            <div className="mt-4 space-y-3">
              <ProblemSection
                label="Status"
                value={problem.currentStatus ?? problem.keyData ?? "No current status yet"}
              />
              <ProblemSection
                label="Evidence"
                value={problem.evidence ?? problem.keyData ?? "No key evidence yet"}
              />
              <ProblemSection
                label="Treatment"
                value={problem.treatment ?? "No active treatment documented"}
              />
              <details className="rounded-[18px] border clinical-divider bg-[color:var(--color-paper-3)] px-3 py-2.5">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--color-ink)]">
                  Reasoning
                </summary>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {problem.reasoning ?? "No concise reasoning documented"}
                </p>
              </details>
              <ProblemSection
                label="Today's Plan"
                value={problem.todayPlan ?? problem.plan ?? "No plan documented"}
              />

              <div className="rounded-[18px] border clinical-divider bg-[color:var(--color-paper-3)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[color:var(--color-ink)]">Tasks</p>
                  <p className="text-xs text-muted">{incompleteCount} incomplete</p>
                </div>
                <div className="mt-3 space-y-2">
                  {linkedTasks.length > 0 ? (
                    linkedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-[16px] border clinical-divider bg-white px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{task.title}</p>
                              <Pill tone={statusTone(task.status)}>{labelForTaskStatus(task.status)}</Pill>
                              <Pill tone={priorityTone(task.priority)}>
                                {labelForTaskPriority(task.priority)}
                              </Pill>
                            </div>
                            <p className="mt-1 text-xs text-muted">
                              {task.ownerName ?? "Unassigned"}
                              {task.dueAt ? ` | Due ${formatDateTime(task.dueAt)}` : ""}
                            </p>
                          </div>
                          {canEdit && task.status !== "done" ? (
                            <form action={updateStatusAction}>
                              <input type="hidden" name="patientId" value={patientId} />
                              <input type="hidden" name="taskId" value={task.id} />
                              <input type="hidden" name="status" value="done" />
                              <input type="hidden" name="updatedAt" value={task.updatedAt} />
                              <PendingGhostButton pendingLabel="Updating...">Mark done</PendingGhostButton>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted">No linked tasks yet</p>
                  )}
                </div>

                {canEdit ? (
                  <TaskCreator
                    className="panel-accent mt-3 w-full rounded-[18px]"
                    buttonClassName="mt-0 ml-auto"
                    panelClassName="mt-0 w-full"
                    headerClassName="items-start"
                    contentClassName="space-y-3"
                  >
                    <form action={saveTaskAction} className="space-y-3">
                      <input type="hidden" name="patientId" value={patientId} />
                      <input type="hidden" name="problemId" value={problem.id} />
                      <Field label="Task title">
                        <TextInput
                          name="title"
                          list={`task-template-suggestions-${problem.id}`}
                          placeholder="Type task title"
                          required
                        />
                      </Field>
                      <datalist id={`task-template-suggestions-${problem.id}`}>
                        {templates.map((template) => (
                          <option key={template.id} value={template.title} />
                        ))}
                      </datalist>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Owner">
                          <SelectBox name="ownerId" defaultValue={defaultTaskOwnerId}>
                            <StaffOptions profiles={profiles} />
                          </SelectBox>
                        </Field>
                        <Field label="Priority">
                          <SelectBox name="priority" defaultValue="normal">
                            <option value="normal">Normal</option>
                            <option value="urgent">Urgent</option>
                            <option value="emergency">Emergency</option>
                          </SelectBox>
                        </Field>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Status">
                          <SelectBox name="status" defaultValue="not_started">
                            <option value="not_started">Not started</option>
                            <option value="in_progress">In progress</option>
                            <option value="done">Done</option>
                            <option value="blocked">Blocked</option>
                          </SelectBox>
                        </Field>
                        <Field label="Type">
                          <SelectBox name="type" defaultValue="other">
                            <option value="lab">lab</option>
                            <option value="imaging">imaging</option>
                            <option value="consult">consult</option>
                            <option value="procedure">procedure</option>
                            <option value="family_talk">Family talk</option>
                            <option value="discharge">Discharge</option>
                            <option value="medication">Medication</option>
                            <option value="other">Other</option>
                          </SelectBox>
                        </Field>
                      </div>
                      <Field label="Note">
                        <TextArea name="note" placeholder="Short task note" />
                      </Field>
                      <div className="flex justify-end">
                        <SubmitButton>Create task under problem</SubmitButton>
                      </div>
                    </form>
                  </TaskCreator>
                ) : null}
              </div>

              {canEdit ? (
                <ProblemEditor>
                  <form action={saveProblemAction} className="space-y-3">
                    <input type="hidden" name="id" value={problem.id} />
                    <input type="hidden" name="patientId" value={patientId} />
                    <input type="hidden" name="updatedAt" value={problem.updatedAt} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Problem name">
                        <TextInput name="title" defaultValue={problem.title} required />
                      </Field>
                      <Field label="Priority">
                        <SelectBox name="priority" defaultValue={problem.priority}>
                          <option value="ACTIVE_UNSTABLE">Active unstable</option>
                          <option value="ACTIVE_STABLE">Active stable</option>
                          <option value="MONITORING">Monitoring</option>
                          <option value="RESOLVED_CHRONIC">Resolved / chronic</option>
                        </SelectBox>
                      </Field>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Status tag">
                        <SelectBox name="status" defaultValue={problem.status}>
                          <option value="active">Active</option>
                          <option value="improving">Improving</option>
                          <option value="worsening">Worsening</option>
                          <option value="resolved">Resolved</option>
                        </SelectBox>
                      </Field>
                      <Field label="Handover key line">
                        <TextInput name="keyData" defaultValue={problem.keyData ?? ""} />
                      </Field>
                    </div>
                    <Field label="Current status">
                      <TextArea name="currentStatus" defaultValue={problem.currentStatus ?? ""} />
                    </Field>
                    <Field label="Evidence">
                      <TextArea name="evidence" defaultValue={problem.evidence ?? ""} />
                    </Field>
                    <Field label="Treatment">
                      <TextArea name="treatment" defaultValue={problem.treatment ?? ""} />
                    </Field>
                    <Field label="Reasoning">
                      <TextArea name="reasoning" defaultValue={problem.reasoning ?? ""} />
                    </Field>
                    <Field label="Today's plan">
                      <TextArea name="todayPlan" defaultValue={problem.todayPlan ?? problem.plan ?? ""} />
                    </Field>
                    <details className="rounded-[18px] border clinical-divider bg-[color:var(--color-paper-3)] px-3 py-2.5">
                      <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--color-ink)]">
                        Handover extras
                      </summary>
                      <div className="mt-3 space-y-3">
                        <Field label="Pending issues">
                          <TextArea name="pending" defaultValue={problem.pending ?? ""} />
                        </Field>
                        <Field label="Watch out">
                          <TextArea name="watchOut" defaultValue={problem.watchOut ?? ""} />
                        </Field>
                        <Field label="Legacy plan line">
                          <TextArea name="plan" defaultValue={problem.plan ?? ""} />
                        </Field>
                      </div>
                    </details>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        name="includeInHandover"
                        defaultChecked={problem.includeInHandover}
                      />
                      Include in handover
                    </label>
                    <SubmitButton pendingLabel="Updating problem...">Update problem</SubmitButton>
                  </form>
                </ProblemEditor>
              ) : null}
            </div>
          </details>
        );
      })}

      {resolved.length > 0 ? (
        <details className="rounded-[22px] border border-dashed clinical-divider bg-[color:var(--color-paper-3)] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[color:var(--color-ink-2)]">
            Resolved / chronic ({resolved.length})
          </summary>
          <div className="mt-3 space-y-2">
            {resolved.map((problem) => (
              <div key={problem.id} className="rounded-[18px] border clinical-divider bg-white px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={problemPriorityTone(problem.priority)}>
                    {labelForProblemPriority(problem.priority)}
                  </Pill>
                  <p className="text-sm font-semibold text-[color:var(--color-ink)]">{problem.title}</p>
                </div>
                {problem.currentStatus ? (
                  <p className="mt-1 text-sm text-muted">{problem.currentStatus}</p>
                ) : null}
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
  problems,
  updateStatusAction,
  saveTaskAction,
  saveTaskUpdateAction,
  profiles,
  canEdit,
}: {
  tasks: TaskWithUpdates[];
  patient: Patient;
  problems: Problem[];
  updateStatusAction: (formData: FormData) => Promise<void>;
  saveTaskAction: (formData: FormData) => Promise<void>;
  saveTaskUpdateAction: (formData: FormData) => Promise<void>;
  profiles: UserProfile[];
  canEdit: boolean;
}) {
  const active = tasks.filter((task) => task.status !== "done");
  const archived = tasks.filter((task) => task.status === "done");
  const problemMap = new Map(problems.map((problem) => [problem.id, problem]));
  const linked = active.filter((task) => task.problemId);
  const general = active.filter((task) => !task.problemId);

  return (
    <div className="space-y-4">
      <div className="grid gap-2.5 md:grid-cols-3">
        <InfoBlock label="All incomplete" value={String(active.length)} />
        <InfoBlock label="Problem-linked" value={String(linked.length)} />
        <InfoBlock label="General tasks" value={String(general.length)} />
      </div>

      <TaskBucket
        title="Problem-linked tasks"
        emptyLabel="No incomplete tasks linked to a problem"
        tasks={linked}
        patient={patient}
        problemMap={problemMap}
        profiles={profiles}
        updateStatusAction={updateStatusAction}
        saveTaskAction={saveTaskAction}
        saveTaskUpdateAction={saveTaskUpdateAction}
        canEdit={canEdit}
      />

      <TaskBucket
        title="General tasks"
        emptyLabel="No general incomplete task"
        tasks={general}
        patient={patient}
        problemMap={problemMap}
        profiles={profiles}
        updateStatusAction={updateStatusAction}
        saveTaskAction={saveTaskAction}
        saveTaskUpdateAction={saveTaskUpdateAction}
        canEdit={canEdit}
      />

      {archived.length > 0 ? (
        <details className="rounded-[24px] border border-dashed clinical-divider bg-[color:var(--color-paper-3)] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[color:var(--color-ink-2)]">
            Archived done task ({archived.length})
          </summary>
          <div className="mt-3 space-y-3">
            {archived.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                patient={patient}
                problem={task.problemId ? problemMap.get(task.problemId) ?? null : null}
                updateStatusAction={updateStatusAction}
                saveTaskAction={saveTaskAction}
                saveTaskUpdateAction={saveTaskUpdateAction}
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

function TaskBucket({
  title,
  emptyLabel,
  tasks,
  patient,
  problemMap,
  profiles,
  updateStatusAction,
  saveTaskAction,
  saveTaskUpdateAction,
  canEdit,
}: {
  title: string;
  emptyLabel: string;
  tasks: TaskWithUpdates[];
  patient: Patient;
  problemMap: Map<string, Problem>;
  profiles: UserProfile[];
  updateStatusAction: (formData: FormData) => Promise<void>;
  saveTaskAction: (formData: FormData) => Promise<void>;
  saveTaskUpdateAction: (formData: FormData) => Promise<void>;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[color:var(--color-ink)]">{title}</p>
        <p className="text-xs text-muted">{tasks.length} task</p>
      </div>
      {tasks.length > 0 ? (
        tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            patient={patient}
            problem={task.problemId ? problemMap.get(task.problemId) ?? null : null}
            updateStatusAction={updateStatusAction}
            saveTaskAction={saveTaskAction}
            saveTaskUpdateAction={saveTaskUpdateAction}
            profiles={profiles}
            canEdit={canEdit}
          />
        ))
      ) : (
        <div className="rounded-[18px] border clinical-divider bg-white px-3 py-3 text-sm text-muted">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  patient,
  problem,
  updateStatusAction,
  saveTaskAction,
  saveTaskUpdateAction,
  profiles,
  canEdit,
  compact = false,
}: {
  task: TaskWithUpdates;
  patient: Patient;
  problem: Problem | null;
  updateStatusAction: (formData: FormData) => Promise<void>;
  saveTaskAction: (formData: FormData) => Promise<void>;
  saveTaskUpdateAction: (formData: FormData) => Promise<void>;
  profiles: UserProfile[];
  canEdit: boolean;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[22px] border clinical-divider bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-foreground">{task.title}</p>
            <Pill tone={statusTone(task.status)}>{labelForTaskStatus(task.status)}</Pill>
            <Pill tone={priorityTone(task.priority)}>{labelForTaskPriority(task.priority)}</Pill>
            <Pill tone="bg-sky-100 text-sky-700">{labelForTaskType(task.type)}</Pill>
          </div>
          <div className="mt-1.5 space-y-1 text-sm text-muted">
            {problem ? <p>Problem: {problem.title}</p> : <p>Problem: General task</p>}
            <p>Owner: {task.ownerName ?? "Unassigned"}</p>
            {task.dueAt ? <p>Due: {formatDateTime(task.dueAt)}</p> : null}
            {task.note ? <p className="line-clamp-2">Note: {task.note}</p> : null}
          </div>
        </div>
        <div className="text-right text-sm text-muted">
          <p>{labelForTaskStatus(task.status)}</p>
        </div>
      </div>

      {task.blockedReason ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-[18px] border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-soft)] px-3 py-2 text-sm text-[color:var(--color-danger)]">
          <AlertCircle className="h-4 w-4" />
          Blocked reason: {task.blockedReason}
        </div>
      ) : null}

      {!compact ? (
        <details className="mt-3 rounded-[20px] border clinical-divider bg-[color:var(--color-paper-3)] p-3 md:mt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[color:var(--color-ink)]">
            <span>Expand details</span>
            <ChevronDown className="h-4 w-4 text-[color:var(--color-ink-2)] transition-transform details-open:rotate-180" />
          </summary>

          <div className="mt-4 space-y-4">
            {task.updates.length > 0 ? (
              <div className="space-y-2">
                {task.updates.slice(0, 3).map((update) => (
                  <div key={update.id} className="rounded-[18px] border border-[color:var(--color-accent)]/20 bg-[color:var(--color-accent-soft)]/70 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                      <span>{update.createdByName}</span>
                      <span>{formatRelative(update.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{update.note}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {canEdit ? (
              <div className="flex flex-wrap items-center gap-2">
                {(["not_started", "in_progress", "done", "blocked"] as const).map((status) => (
                  <form action={updateStatusAction} key={status}>
                    <input type="hidden" name="patientId" value={patient.id} />
                    <input type="hidden" name="taskId" value={task.id} />
                    <input type="hidden" name="status" value={status} />
                    <input type="hidden" name="updatedAt" value={task.updatedAt} />
                    <PendingGhostButton active={task.status === status} pendingLabel="Updating...">
                      {labelForTaskStatus(status)}
                    </PendingGhostButton>
                  </form>
                ))}
              </div>
            ) : null}

            {canEdit ? (
              <form action={saveTaskUpdateAction} className="space-y-2">
                <input type="hidden" name="taskId" value={task.id} />
                <Field label="Add update">
                  <TextArea
                    name="note"
                    placeholder="Short update for handover"
                    className="min-h-20"
                    required
                  />
                </Field>
                <SubmitButton pendingLabel="Saving update...">Add update</SubmitButton>
              </form>
            ) : null}

            {canEdit ? (
              <TaskEditor>
                <form action={saveTaskAction} className="space-y-3">
                  <input type="hidden" name="id" value={task.id} />
                  <input type="hidden" name="patientId" value={patient.id} />
                  <input type="hidden" name="problemId" value={task.problemId ?? ""} />
                  <input type="hidden" name="updatedAt" value={task.updatedAt} />
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
                        <option value="not_started">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                        <option value="blocked">Blocked</option>
                      </SelectBox>
                    </Field>
                    <Field label="Priority">
                      <SelectBox name="priority" defaultValue={task.priority}>
                        <option value="normal">Normal</option>
                        <option value="urgent">Urgent</option>
                        <option value="emergency">Emergency</option>
                      </SelectBox>
                    </Field>
                  </div>
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
                  <Field label="Note">
                    <TextArea name="note" defaultValue={task.note ?? ""} />
                  </Field>
                  <Field label="Blocked reason">
                    <TextArea name="blockedReason" defaultValue={task.blockedReason ?? ""} />
                  </Field>
                  <SubmitButton pendingLabel="Updating task...">Update task</SubmitButton>
                </form>
              </TaskEditor>
            ) : null}
          </div>
        </details>
      ) : null}

      {!compact ? (
        <p className="mt-4 text-xs text-muted">
          Updated by {task.updatedByName ?? "Unknown"} | {formatRelative(task.updatedAt)}
        </p>
      ) : null}
    </div>
  );
}

function ProblemSection({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border clinical-divider bg-[color:var(--color-paper-3)] px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1.5 text-sm leading-6 text-foreground">{value}</p>
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
        <details className="rounded-[22px] border clinical-divider bg-[color:var(--color-paper-3)] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[color:var(--color-ink-2)]">
            ดู activity เพิ่มเติม ({remainingItems.length})
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
    <div className={cn("flex gap-3 rounded-[22px] border clinical-divider bg-white p-4", compact && "p-3")}>
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] bg-[color:var(--color-accent-soft)] text-sm font-semibold text-[color:var(--color-accent-strong)]">
        {getInitials(item.actorName)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{item.actorName}</p>
          <p className="text-[11px] text-muted">{formatDateTime(item.createdAt)}</p>
        </div>
        <p className="mt-1 text-sm text-muted">{labelForActivityAction(item.action)}</p>
      </div>
    </div>
  );
}

export function HandoverCards({ bundles }: { bundles: HandoverBundle[] }) {
  return (
    <div className="space-y-6">
      {bundles.map((bundle) => (
        <GlassPanel key={bundle.ward.id} title={bundle.ward.name}>
          <div className="space-y-4">
            {bundle.patients
              .filter(
                (patient) =>
                  patient.status !== "stable" ||
                  patient.tasks.some((task) => task.status !== "done") ||
                  patient.problems.some((problem) => problem.watchOut || problem.pending),
              )
              .map((patient) => (
                <div key={patient.id} className="rounded-[24px] border clinical-divider bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-muted">Bed {patient.bed}</p>
                      <h3 className="mt-1 text-lg font-semibold text-foreground">{patient.diagnosis}</h3>
                    </div>
                    <Pill tone={statusTone(patient.status)}>{labelForPatientStatus(patient.status)}</Pill>
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
                      title="Observe"
                      items={[patient.handover?.escalationInstruction ?? "ยังไม่มีคำสั่ง observe เพิ่มเติม"]}
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

export function HandoverTextPanel({
  text,
  wardName,
}: {
  text: string;
  wardName: string;
}) {
  return (
    <GlassPanel
      title="Structured handover text"
      action={<CopyTextButton text={text} />}
    >
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">{wardName}</div>
      <textarea
        readOnly
        value={text}
        className="min-h-72 w-full rounded-[22px] border clinical-divider bg-white px-4 py-4 text-sm text-foreground outline-none"
      />
    </GlassPanel>
  );
}

export function TaskInbox({
  items,
  linkToPatient = false,
}: {
  items: Array<{ task: WardTask; patient: Patient }>;
  linkToPatient?: boolean;
}) {
  return (
    <div className="space-y-3">
      {items.map(({ task, patient }) => {
        const card = (
          <div className="rounded-[22px] border clinical-divider bg-white p-4 transition hover:border-[color:var(--color-accent)]/30 hover:bg-[color:var(--color-accent-soft)]/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-foreground">{task.title}</p>
                  <Pill tone={statusTone(task.status)}>{labelForTaskStatus(task.status)}</Pill>
                  <Pill tone={priorityTone(task.priority)}>{labelForTaskPriority(task.priority)}</Pill>
                </div>
                <p className="mt-1 text-sm text-muted">
                  Bed {patient.bed} | {patient.displayName} | {patient.diagnosis}
                </p>
              </div>
              <div className="text-right text-xs text-muted">
                <p>{task.ownerName ?? "Unassigned"}</p>
                <p>{task.dueAt ? formatDateTime(task.dueAt) : "No due time"}</p>
              </div>
            </div>
          </div>
        );

        return linkToPatient ? (
          <Link key={task.id} href={`/patients/${patient.id}`} className="block">
            {card}
          </Link>
        ) : (
          <div key={task.id}>{card}</div>
        );
      })}
    </div>
  );
}

export function DischargedPatientList({
  items,
  canHardDelete = false,
  hardDeleteAction,
}: {
  items: DischargedDirectoryItem[];
  canHardDelete?: boolean;
  hardDeleteAction?: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      {items.map(({ patient, ward, summary }) => (
        <div
          key={patient.id}
          className="rounded-[24px] border clinical-divider bg-white p-5 transition hover:border-[color:var(--color-accent)]/30 hover:bg-[color:var(--color-accent-soft)]/50"
        >
          <Link
            href={`/discharged/${patient.id}`}
            className="block transition hover:-translate-y-0.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted">
                  {ward?.name ?? "-"} | Bed {patient.bed}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">{patient.displayName}</h3>
                <p className="mt-1 text-sm text-muted">{patient.diagnosis}</p>
              </div>
              <div className="text-right text-xs text-muted">
                <p>{patient.dischargedAt ? formatDateTime(patient.dischargedAt) : "-"}</p>
                <p>{summary ? "Summary ready" : "No summary yet"}</p>
              </div>
            </div>
          </Link>
          {canHardDelete && hardDeleteAction ? (
            <form action={hardDeleteAction} className="mt-4 flex justify-end">
              <input type="hidden" name="patientId" value={patient.id} />
              <ConfirmingSubmitButton
                confirmMessage={`Hard delete ${patient.displayName}? This cannot be undone.`}
                pendingLabel="Deleting patient..."
                className="px-4 py-2 text-xs"
              >
                Hard delete
              </ConfirmingSubmitButton>
            </form>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function Field({
  label,
  children,
  className,
  labelClassName,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <label className={cn("block text-sm font-medium text-foreground", className)}>
      <span
        className={cn(
          "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted",
          labelClassName,
        )}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-[18px] border clinical-divider bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-[color:var(--color-focus)] focus:ring-4 focus:ring-[color:var(--color-focus)]/10",
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
        "min-h-24 w-full rounded-[18px] border clinical-divider bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-[color:var(--color-focus)] focus:ring-4 focus:ring-[color:var(--color-focus)]/10",
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
        "w-full rounded-[18px] border clinical-divider bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-[color:var(--color-focus)] focus:ring-4 focus:ring-[color:var(--color-focus)]/10",
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
  body?: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed clinical-divider bg-white/78 p-8 text-center">
      <Clock3 className="mx-auto h-8 w-8 text-[color:var(--color-ink-2)]" />
      <h3 className="mt-3 font-display text-lg font-semibold text-foreground">{title}</h3>
      {body ? <p className="mt-2 text-sm text-[color:var(--color-ink-2)]">{body}</p> : null}
    </div>
  );
}

export function SetupNotice({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <div className="rounded-[24px] border border-[color:var(--color-warning)]/35 bg-[color:var(--color-warning)]/12 p-4 text-sm text-foreground">
      <p className="font-semibold">{title}</p>
      {body ? <p className="mt-2 leading-6">{body}</p> : null}
    </div>
  );
}

export function LoadingShell({
  title = "Loading data",
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-6">
      <GlassPanel title={title} subtitle={subtitle} headingLevel={1}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

export function LoginSkeleton() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10">
      <div className="glass-card soft-grid w-full overflow-hidden rounded-[36px] p-6 md:p-10">
        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <SkeletonBlock className="h-5 w-32" />
            <SkeletonBlock className="h-12 w-full max-w-xl" />
            <SkeletonBlock className="h-5 w-full max-w-2xl" />
            <div className="grid gap-4 md:grid-cols-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
          <div className="app-panel rounded-[28px] p-6">
            <SkeletonBlock className="h-6 w-40" />
            <div className="mt-5 space-y-3">
              <SkeletonBlock className="h-14 w-full rounded-2xl" />
              <SkeletonBlock className="h-14 w-full rounded-2xl" />
              <SkeletonBlock className="h-12 w-36 rounded-full" />
            </div>
          </div>
        </div>
      </div>
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
        <div key={template.id} className="rounded-[22px] border clinical-divider bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{template.title}</p>
            <Pill tone="bg-sky-100 text-sky-700">{labelForTaskType(template.type)}</Pill>
          </div>
          <p className="mt-3 text-sm text-muted">
            ความสำคัญเริ่มต้น: {labelForTaskPriority(template.defaultPriority)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function StaffRoleCards({
  profiles,
  wards,
  updateUserRoleAction,
  deleteUserAction,
}: {
  profiles: UserProfile[];
  wards: Ward[];
  updateUserRoleAction: (formData: FormData) => Promise<void>;
  deleteUserAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {profiles.map((profile) => (
        <div key={profile.id} className="panel-subtle rounded-[24px] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-foreground">{profile.name}</p>
              <p className="mt-1 text-sm text-[color:var(--color-ink-2)]">{profile.email}</p>
              <div className="mt-3">
                <Pill tone="border-[color:var(--color-rule)] bg-white text-[color:var(--color-ink-2)]">
                  {labelForRole(profile.role)}
                </Pill>
              </div>
            </div>
          </div>
          <AdminEditor buttonLabel="Edit role" panelTitle={`Edit role | ${profile.name}`}>
            <form action={updateUserRoleAction} className="mt-4 space-y-3">
              <input type="hidden" name="userId" value={profile.id} />
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Role">
                  <SelectBox name="role" defaultValue={profile.role} className="min-w-44">
                    <option value="admin">Admin</option>
                    <option value="resident">Resident</option>
                    <option value="student">Student</option>
                  </SelectBox>
                </Field>
                <SubmitButton>Save role</SubmitButton>
              </div>

              {profile.role === "student" ? (
                <Field label="Assigned ward for student">
                  <SelectBox
                    name="wardAssignment"
                    defaultValue={profile.wardAssignment ?? ""}
                    className="min-w-56"
                  >
                    <option value="">Unassigned</option>
                    {wards.map((ward) => (
                      <option key={ward.id} value={ward.id}>
                        {ward.name}
                      </option>
                    ))}
                  </SelectBox>
                </Field>
              ) : (
                <input type="hidden" name="wardAssignment" value="" />
              )}
            </form>
          </AdminEditor>
          <div className="mt-4 border-t clinical-divider pt-4">
            {profile.role === "admin" ? (
              <p className="text-sm font-medium text-[color:var(--color-ink-2)]">Admin user cannot be deleted.</p>
            ) : (
              <form action={deleteUserAction} className="flex justify-end">
                <input type="hidden" name="userId" value={profile.id} />
                <ConfirmingSubmitButton
                  confirmMessage={`Hard delete ${profile.name}? Patients and tasks assigned to this user will become unassigned.`}
                  pendingLabel="Deleting user..."
                  className="px-4 py-2 text-xs"
                >
                  Delete user
                </ConfirmingSubmitButton>
              </form>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export { DangerZone };

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[color:var(--color-accent-soft)]/70 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[24px] bg-[color:var(--color-accent-soft)]/75 p-4">
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

function SkeletonCard() {
  return (
    <div className="rounded-[28px] border clinical-divider bg-white/78 p-4">
      <SkeletonBlock className="h-4 w-24" />
      <SkeletonBlock className="mt-3 h-7 w-40" />
      <SkeletonBlock className="mt-3 h-4 w-full" />
      <SkeletonBlock className="mt-2 h-4 w-2/3" />
      <div className="mt-4 flex gap-2">
        <SkeletonBlock className="h-7 w-20 rounded-full" />
        <SkeletonBlock className="h-7 w-24 rounded-full" />
      </div>
      <div className="mt-5 flex items-center justify-between">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-4 w-20" />
      </div>
    </div>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-[color:var(--color-paper-3)]", className)} />;
}
