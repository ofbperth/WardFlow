"use client";

import Link from "next/link";
import { startTransition, useEffect, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  Shuffle,
  TriangleAlert,
} from "lucide-react";
import { Field, Pill, SelectBox, StaffOptions, SubmitButton, TextInput } from "@/components/wardflow-ui";
import {
  cn,
  formatRelative,
  labelForTaskPriority,
  labelForTaskStatus,
  labelForTaskType,
  priorityTone,
  statusTone,
} from "@/lib/utils";
import type { TaskWorkspaceGroup, UserProfile } from "@/lib/types";

type NoticeState =
  | { tone: "working"; message: string }
  | { tone: "success"; message: string }
  | null;

type BoardState = {
  groups: TaskWorkspaceGroup[];
  archivedGroups: TaskWorkspaceGroup[];
};

function patchTaskInGroups(
  groups: TaskWorkspaceGroup[],
  patientId: string,
  taskId: string,
  patch: Partial<TaskWorkspaceGroup["patients"][number]["tasks"][number]>,
) {
  return groups.map((group) => ({
    ...group,
    patients: group.patients.map((patient) =>
      patient.id !== patientId
        ? patient
        : {
            ...patient,
            tasks: patient.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
          },
    ),
  }));
}

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
  const router = useRouter();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [notice, setNotice] = useState<NoticeState>(null);
  const [openTaskPanels, setOpenTaskPanels] = useState<Record<string, boolean>>({});
  const [boardState, applyBoardState] = useOptimistic<BoardState, (state: BoardState) => BoardState>(
    { groups, archivedGroups },
    (currentState, update) => update(currentState),
  );

  useEffect(() => {
    if (!notice || notice.tone === "working") return;
    const timeout = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function runTaskAction({
    workingMessage,
    successMessage,
    taskId,
    optimisticUpdate,
    action,
  }: {
    workingMessage: string;
    successMessage: string;
    taskId: string;
    optimisticUpdate?: () => void;
    action: () => Promise<void>;
  }) {
    setNotice({ tone: "working", message: workingMessage });
    optimisticUpdate?.();
    setOpenTaskPanels((current) => ({ ...current, [taskId]: false }));

    try {
      await action();
      setNotice({ tone: "success", message: successMessage });
      startRefreshTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setNotice(null);
      startRefreshTransition(() => {
        router.refresh();
      });
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <div
          className={
            notice.tone === "working"
              ? "sticky top-4 z-20 flex items-center gap-3 rounded-[24px] border border-sky-200 bg-sky-50/95 px-4 py-3 text-sm text-sky-900 shadow-lg shadow-sky-950/5 backdrop-blur"
              : "sticky top-4 z-20 flex items-center gap-3 rounded-[24px] border border-mint-200 bg-mint-50/95 px-4 py-3 text-sm text-mint-900 shadow-lg shadow-mint-950/5 backdrop-blur"
          }
        >
          {notice.tone === "working" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <span>{notice.message}</span>
          {isRefreshing ? <span className="text-xs opacity-70">Refreshing view...</span> : null}
        </div>
      ) : null}

      {boardState.groups.map((group) => (
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
                      className="rounded-[24px] border border-white/70 bg-white/90 p-4 shadow-sm transition-opacity data-[busy=true]:opacity-80"
                      data-busy={notice?.tone === "working" ? "true" : "false"}
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

                      <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenTaskPanels((current) => ({ ...current, [task.id]: !current[task.id] }))
                          }
                          className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-slate-700"
                        >
                          <span>Expand details</span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-slate-500 transition-transform",
                              openTaskPanels[task.id] ? "rotate-180" : "",
                            )}
                          />
                        </button>

                        {openTaskPanels[task.id] ? (
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
                            <form
                              action={async (formData) => {
                                const nextOwnerId =
                                  typeof formData.get("ownerId") === "string" && String(formData.get("ownerId")).trim()
                                    ? String(formData.get("ownerId")).trim()
                                    : null;
                                const nextOwner =
                                  (profilesByWard[patient.wardId] ?? []).find((profile) => profile.id === nextOwnerId) ??
                                  null;

                                await runTaskAction({
                                  workingMessage: `Reassigning ${task.title}...`,
                                  successMessage: `Updated owner for ${task.title}`,
                                  taskId: task.id,
                                  optimisticUpdate: () => {
                                    startTransition(() => {
                                      applyBoardState((current) => ({
                                        groups: patchTaskInGroups(current.groups, patient.id, task.id, {
                                          ownerId: nextOwnerId,
                                          ownerName: nextOwner?.name ?? null,
                                        }),
                                        archivedGroups: patchTaskInGroups(
                                          current.archivedGroups,
                                          patient.id,
                                          task.id,
                                          {
                                            ownerId: nextOwnerId,
                                            ownerName: nextOwner?.name ?? null,
                                          },
                                        ),
                                      }));
                                    });
                                  },
                                  action: () => saveTaskAction(formData),
                                });
                              }}
                              className="rounded-2xl bg-white/80 p-3"
                            >
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
                              <form
                                action={async (formData) => {
                                  await runTaskAction({
                                    workingMessage: `Marking ${task.title} as done...`,
                                    successMessage: `${task.title} marked done`,
                                    taskId: task.id,
                                    optimisticUpdate: () => {
                                      startTransition(() => {
                                        applyBoardState((current) => ({
                                          groups: patchTaskInGroups(current.groups, patient.id, task.id, {
                                            status: "done",
                                          }),
                                          archivedGroups: patchTaskInGroups(
                                            current.archivedGroups,
                                            patient.id,
                                            task.id,
                                            { status: "done" },
                                          ),
                                        }));
                                      });
                                    },
                                    action: () => updateTaskStatusAction(formData),
                                  });
                                }}
                                className="rounded-2xl bg-emerald-50/80 p-3"
                              >
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

                              <form
                                action={async (formData) => {
                                  const blockedReason =
                                    typeof formData.get("blockedReason") === "string"
                                      ? String(formData.get("blockedReason")).trim()
                                      : "";

                                  await runTaskAction({
                                    workingMessage: `Saving block for ${task.title}...`,
                                    successMessage: `Blocked reason saved for ${task.title}`,
                                    taskId: task.id,
                                    optimisticUpdate: () => {
                                      startTransition(() => {
                                        applyBoardState((current) => ({
                                          groups: patchTaskInGroups(current.groups, patient.id, task.id, {
                                            status: "blocked",
                                            blockedReason,
                                          }),
                                          archivedGroups: patchTaskInGroups(
                                            current.archivedGroups,
                                            patient.id,
                                            task.id,
                                            {
                                              status: "blocked",
                                              blockedReason,
                                            },
                                          ),
                                        }));
                                      });
                                    },
                                    action: () => saveTaskAction(formData),
                                  });
                                }}
                                className="rounded-2xl bg-rose-50/80 p-3"
                              >
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
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {boardState.archivedGroups.length > 0 ? (
        <details className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50/70 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">
            Archived done tasks
          </summary>
          <div className="mt-4 space-y-4">
            {boardState.archivedGroups.map((group) => (
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
