import Link from "next/link";
import { saveTaskAction, updateTaskStatusAction } from "@/app/actions";
import { AppFeedbackToast } from "@/components/app-feedback-toast";
import { TaskWorkspaceBoard } from "@/components/task-workspace-board";
import {
  EmptyState,
  ExpandableFilters,
  Field,
  GlassPanel,
  SelectBox,
  SetupNotice,
  SubmitButton,
} from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getMyTasks } from "@/lib/wardflow";
import type { TaskWorkspaceFilters } from "@/lib/types";
import { labelForTaskType } from "@/lib/utils";

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams?: Promise<{ toast?: string; wardId?: string; ownerId?: string; type?: TaskWorkspaceFilters["type"] }>;
}) {
  const session = await requireAppSession();
  const params = (await searchParams) ?? {};
  const data = await getMyTasks(session, {
    wardId: params.wardId ?? "",
    ownerId: params.ownerId ?? "",
    type: params.type ?? "",
  });

  return (
    <div className="space-y-6">
      <AppFeedbackToast toastKey={params.toast} />

      <GlassPanel headingLevel={1} title="Ward work" className="work-list-panel" compact>
        {data.blockedByMissingWard ? (
          <SetupNotice title="Ward assignment required" body="Ask an admin to assign one or more Wards before ward work can be shown." />
        ) : (
          <>
            {(params.wardId || params.ownerId || params.type) ? <div className="mb-3 flex flex-wrap items-center gap-2 text-xs" aria-label="Active filters">
              {params.wardId ? <span className="status-strip rounded-full px-3 py-1">{data.wards.find(ward => ward.id === params.wardId)?.name ?? "Ward"}</span> : null}
              {params.ownerId ? <span className="status-strip rounded-full px-3 py-1">{params.ownerId === "unassigned" ? "Unassigned" : data.profiles.find(profile => profile.id === params.ownerId)?.name ?? "Assigned"}</span> : null}
              {params.type ? <span className="status-strip rounded-full px-3 py-1">{labelForTaskType(params.type)}</span> : null}
              <Link href="/my-tasks" className="inline-flex min-h-11 items-center px-2 underline">Clear</Link>
            </div> : null}
            <ExpandableFilters title="Filters">
              <form className="grid grid-cols-2 gap-2.5 md:gap-3 lg:grid-cols-4">
                <Field
                  label="Ward"
                  className="col-span-1"
                  labelClassName="mb-1 text-[11px] tracking-[0.12em] md:mb-1.5 md:text-xs"
                >
                  <SelectBox
                    name="wardId"
                    defaultValue={params.wardId ?? ""}
                    className="px-3.5 py-2.5 text-[13px] md:px-4 md:py-3 md:text-sm"
                  >
                    <option value="">All visible wards</option>
                    {data.wards.map((ward) => (
                      <option key={ward.id} value={ward.id}>
                        {ward.name}
                      </option>
                    ))}
                  </SelectBox>
                </Field>
                <Field
                  label="Type"
                  className="col-span-1"
                  labelClassName="mb-1 text-[11px] tracking-[0.12em] md:mb-1.5 md:text-xs"
                >
                  <SelectBox
                    name="type"
                    defaultValue={params.type ?? ""}
                    className="px-3.5 py-2.5 text-[13px] md:px-4 md:py-3 md:text-sm"
                  >
                    <option value="">All types</option>
                    {(["lab", "imaging", "consult", "procedure", "family_talk", "discharge", "medication", "other"] as const).map((type) => (
                      <option key={type} value={type}>
                        {labelForTaskType(type)}
                      </option>
                    ))}
                  </SelectBox>
                </Field>
                <Field
                  label="Assigned to"
                  className="col-span-2 lg:col-span-1"
                  labelClassName="mb-1 text-[11px] tracking-[0.12em] md:mb-1.5 md:text-xs"
                >
                  <SelectBox
                    name="ownerId"
                    defaultValue={params.ownerId ?? ""}
                    className="px-3.5 py-2.5 text-[13px] md:px-4 md:py-3 md:text-sm"
                  >
                    <option value="">All</option>
                    <option value="unassigned">Unassigned</option>
                    {data.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                  </SelectBox>
                </Field>
                <div className="col-span-2 flex items-end lg:col-span-1">
                  <SubmitButton>Apply</SubmitButton>
                </div>
              </form>
            </ExpandableFilters>

            {data.activeGroups.length || data.archivedGroups.length ? (
              <TaskWorkspaceBoard
                groups={data.activeGroups}
                archivedGroups={data.archivedGroups}
                profilesByWard={data.profilesByWard}
                saveTaskAction={saveTaskAction}
                updateTaskStatusAction={updateTaskStatusAction}
              />
            ) : (
              <EmptyState title="No ward work in view" body="ลองปรับ filter" />
            )}
          </>
        )}
      </GlassPanel>
    </div>
  );
}
