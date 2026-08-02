import { RealtimeRefresh } from "@/components/realtime-refresh";
import {
  EmptyState,
  ExpandableFilters,
  Field,
  GlassPanel,
  HandoverTextPanel,
  Pill,
  SelectBox,
  SetupNotice,
  SubmitButton,
} from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getPendingTaskHandoverData, getPendingTaskHandoverText } from "@/lib/wardflow";
import {
  labelForTaskPriority,
  labelForTaskStatus,
  labelForTaskType,
  priorityTone,
  statusTone,
} from "@/lib/utils";

export default async function PendingTaskHandoverPage({
  searchParams,
}: {
  searchParams?: Promise<{ wardId?: string; mode?: "all" | "mine" | "blocked" }>;
}) {
  const session = await requireAppSession();
  const params = (await searchParams) ?? {};
  const mode = params.mode ?? "all";
  const data = await getPendingTaskHandoverData(session, { wardId: params.wardId ?? "", mode });
  const text = await getPendingTaskHandoverText(session, { wardId: params.wardId ?? "", mode });
  const selectedWardName =
    params.wardId && data.groups.length === 1 ? data.groups[0].ward.name : "All visible wards";

  return (
    <div className="space-y-6">
      <RealtimeRefresh
        channel="pending-task-handover-live"
        filters={[
          { schema: "public", table: "ward_tasks" },
          { schema: "public", table: "task_updates" },
          { schema: "public", table: "patients" },
        ]}
      />

      <GlassPanel
        headingLevel={1}
        title="Pending task handover"
        subtitle="A work-only brief for unfinished, blocked, and owner-dependent tasks."
      >
        {data.blockedByMissingWard ? (
          <SetupNotice title="Ward assignment required" body="Ask an admin to assign one or more Wards before pending tasks can be shown." />
        ) : (
          <>
            <ExpandableFilters title="Filter pending tasks">
              <form className="grid gap-3 lg:grid-cols-3">
                <Field label="Ward">
                  <SelectBox name="wardId" defaultValue={params.wardId ?? ""}>
                    <option value="">All visible wards</option>
                    {data.wards.map((ward) => (
                      <option key={ward.id} value={ward.id}>
                        {ward.name}
                      </option>
                    ))}
                  </SelectBox>
                </Field>
                <Field label="Mode">
                  <SelectBox name="mode" defaultValue={mode}>
                    <option value="all">All pending tasks</option>
                    <option value="mine">My pending tasks</option>
                    <option value="blocked">Blocked only</option>
                  </SelectBox>
                </Field>
                <div className="flex items-end">
                  <SubmitButton>Apply filters</SubmitButton>
                </div>
              </form>
            </ExpandableFilters>

            {data.groups.length ? (
              <div className="grid gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-6">
                  {data.groups.map((group) => (
                    <section key={group.ward.id} className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted">Ward</p>
                          <h3 className="mt-1 text-lg font-semibold text-foreground">{group.ward.name}</h3>
                        </div>
                        <Pill tone="border-[color:var(--color-rule)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-strong)]">
                          {group.patients.reduce((total, patient) => total + patient.tasks.length, 0)} tasks
                        </Pill>
                      </div>

                      <div className="space-y-4">
                        {group.patients.map((patient) => (
                          <div key={patient.id} className="panel-surface rounded-[28px] p-5">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted">Bed {patient.bed}</p>
                            <h4 className="mt-1 text-lg font-semibold text-foreground">{patient.displayName}</h4>
                            <p className="mt-1 text-sm text-muted">{patient.diagnosis}</p>

                            <div className="mt-4 space-y-3">
                              {patient.tasks.map((task) => (
                                <div key={task.id} className="rounded-[24px] border clinical-divider bg-white p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-base font-semibold text-foreground">{task.title}</p>
                                        <Pill tone={priorityTone(task.priority)}>
                                          {labelForTaskPriority(task.priority)}
                                        </Pill>
                                        <Pill tone={statusTone(task.status)}>
                                          {labelForTaskStatus(task.status)}
                                        </Pill>
                                        <Pill tone="bg-sky-100 text-sky-700">{labelForTaskType(task.type)}</Pill>
                                      </div>
                                      <p className="mt-2 text-sm text-muted">{task.note ?? "No note"}</p>
                                    </div>
                                    <div className="text-right text-sm text-muted">
                                      <p>{task.ownerName ?? "Unassigned"}</p>
                                    </div>
                                  </div>

                                  {task.blockedReason ? (
                                    <div className="mt-3 rounded-2xl bg-[color:var(--color-danger-soft)] px-3 py-2 text-sm text-[color:var(--color-danger)]">
                                      {task.blockedReason}
                                    </div>
                                  ) : null}

                                  {task.updates[0] ? (
                                    <div className="mt-3 rounded-2xl bg-[color:var(--color-accent-soft)]/75 px-3 py-2">
                                      <p className="text-xs uppercase tracking-[0.16em] text-muted">
                                        Latest update
                                      </p>
                                      <p className="mt-1 text-sm text-foreground">{task.updates[0].note}</p>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                {text ? <HandoverTextPanel text={text} wardName={selectedWardName} /> : null}
              </div>
            ) : (
              <EmptyState title="No pending tasks" body="ไม่มีงานค้างใน scope นี้" />
            )}
          </>
        )}
      </GlassPanel>
    </div>
  );
}
