import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Shuffle,
  TriangleAlert,
} from "lucide-react";
import { Field, Pill, SelectBox, StaffOptions, SubmitButton, TextInput } from "@/components/wardflow-ui";
import {
  formatRelative,
  labelForTaskPriority,
  labelForTaskStatus,
  labelForTaskType,
  priorityTone,
  statusTone,
} from "@/lib/utils";
import type { TaskWorkspaceGroup, UserProfile } from "@/lib/types";

export function TaskWorkspaceBoard({
  groups,
  archivedGroups,
  profilesByWard,
  saveTaskAction,
  updateTaskStatusAction,
}: {
  groups: TaskWorkspaceGroup[];
  archivedGroups: TaskWorkspaceGroup[];
  profilesByWard: Record<string, UserProfile[]>;
  saveTaskAction: (formData: FormData) => Promise<void>;
  updateTaskStatusAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.ward.id} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Ward</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">{group.ward.name}</h3>
            </div>
            <Pill tone="bg-mint-500/15 text-mint-700">
              {group.patients.reduce((total, patient) => total + patient.tasks.length, 0)} tasks
            </Pill>
          </div>

          <div className="space-y-4">
            {group.patients.map((patient) => (
              <div key={patient.id} className="rounded-[28px] border border-white/70 bg-white/72 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted">Bed {patient.bed}</p>
                    <h4 className="mt-1 text-lg font-semibold text-foreground">{patient.displayName}</h4>
                    <p className="mt-1 text-sm text-muted">{patient.diagnosis}</p>
                  </div>
                  <Link
                    href={`/patients/${patient.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white px-3 py-2 text-xs font-semibold text-foreground"
                  >
                    Open patient
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="mt-4 space-y-3">
                  {patient.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-[24px] border border-white/70 bg-white/90 p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-foreground">{task.title}</p>
                            <Pill tone={statusTone(task.status)}>{labelForTaskStatus(task.status)}</Pill>
                            <Pill tone={priorityTone(task.priority)}>{labelForTaskPriority(task.priority)}</Pill>
                            <Pill tone="bg-sky-100 text-sky-700">{labelForTaskType(task.type)}</Pill>
                          </div>
                          <div className="mt-2 space-y-1 text-sm text-muted">
                            <p>Assigned student: {task.ownerName ?? "Unassigned"}</p>
                            {task.note ? <p className="line-clamp-2">Note: {task.note}</p> : null}
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted">
                          <p>{labelForTaskStatus(task.status)}</p>
                        </div>
                      </div>

                      {task.blockedReason ? (
                        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                          <AlertCircle className="h-4 w-4" />
                          Blocked reason: {task.blockedReason}
                        </div>
                      ) : null}

                      <details className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-700">
                          <span>Expand details</span>
                          <ChevronDown className="h-4 w-4 text-slate-500 transition-transform details-open:rotate-180" />
                        </summary>

                        <div className="mt-4 space-y-3">
                          {task.updates[0] ? (
                            <div className="rounded-2xl bg-mint-50/70 px-3 py-2">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted">
                                Latest update
                              </p>
                              <p className="mt-1 text-sm text-foreground">{task.updates[0].note}</p>
                              <p className="mt-1 text-xs text-muted">
                                {task.updates[0].createdByName} | {formatRelative(task.updates[0].createdAt)}
                              </p>
                            </div>
                          ) : null}

                          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                            <form action={saveTaskAction} className="rounded-2xl bg-white/80 p-3">
                              <input type="hidden" name="id" value={task.id} />
                              <input type="hidden" name="patientId" value={patient.id} />
                              <input type="hidden" name="title" value={task.title} />
                              <input type="hidden" name="status" value={task.status} />
                              <input type="hidden" name="priority" value={task.priority} />
                              <input type="hidden" name="type" value={task.type} />
                              <input type="hidden" name="note" value={task.note ?? ""} />
                              <input type="hidden" name="blockedReason" value={task.blockedReason ?? ""} />
                              <input type="hidden" name="updatedAt" value={task.updatedAt} />
                              <div className="flex flex-wrap items-end gap-3">
                                <Field label="Responsible doctor">
                                  <SelectBox
                                    name="ownerId"
                                    defaultValue={task.ownerId ?? ""}
                                    className="min-w-52"
                                  >
                                    <StaffOptions profiles={profilesByWard[patient.wardId] ?? []} />
                                  </SelectBox>
                                </Field>
                                <SubmitButton pendingLabel="Reassigning...">
                                  <span className="inline-flex items-center gap-2">
                                    <Shuffle className="h-4 w-4" />
                                    Reassign
                                  </span>
                                </SubmitButton>
                              </div>
                            </form>

                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                              <form action={updateTaskStatusAction} className="rounded-2xl bg-emerald-50/80 p-3">
                                <input type="hidden" name="patientId" value={patient.id} />
                                <input type="hidden" name="taskId" value={task.id} />
                                <input type="hidden" name="status" value="done" />
                                <input type="hidden" name="updatedAt" value={task.updatedAt} />
                                <SubmitButton pendingLabel="Marking done...">
                                  <span className="inline-flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Mark done
                                  </span>
                                </SubmitButton>
                              </form>

                              <form action={saveTaskAction} className="rounded-2xl bg-rose-50/80 p-3">
                                <input type="hidden" name="id" value={task.id} />
                                <input type="hidden" name="patientId" value={patient.id} />
                                <input type="hidden" name="title" value={task.title} />
                                <input type="hidden" name="ownerId" value={task.ownerId ?? ""} />
                                <input type="hidden" name="status" value="blocked" />
                                <input type="hidden" name="priority" value={task.priority} />
                                <input type="hidden" name="type" value={task.type} />
                                <input type="hidden" name="note" value={task.note ?? ""} />
                                <input type="hidden" name="updatedAt" value={task.updatedAt} />
                                <Field label="Blocked reason">
                                  <TextInput
                                    name="blockedReason"
                                    defaultValue={task.blockedReason ?? ""}
                                    placeholder="Why is this blocked?"
                                    required
                                  />
                                </Field>
                                <div className="mt-3">
                                  <SubmitButton pendingLabel="Saving block...">
                                    <span className="inline-flex items-center gap-2">
                                      <TriangleAlert className="h-4 w-4" />
                                      Mark blocked
                                    </span>
                                  </SubmitButton>
                                </div>
                              </form>
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {archivedGroups.length > 0 ? (
        <details className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50/70 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">
            Archived done tasks
          </summary>
          <div className="mt-4 space-y-4">
            {archivedGroups.map((group) => (
              <div key={group.ward.id} className="space-y-3">
                <p className="text-sm font-semibold text-foreground">{group.ward.name}</p>
                {group.patients.map((patient) => (
                  <div key={patient.id} className="rounded-2xl bg-white/75 p-4">
                    <p className="text-sm font-semibold text-foreground">
                      Bed {patient.bed} | {patient.displayName}
                    </p>
                    <div className="mt-2 space-y-2">
                      {patient.tasks.map((task) => (
                        <div key={task.id} className="rounded-2xl bg-slate-50/80 px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-700">{task.title}</p>
                            <Pill tone={statusTone(task.status)}>{labelForTaskStatus(task.status)}</Pill>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
