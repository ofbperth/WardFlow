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
  StaffOptions,
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

      <GlassPanel
        headingLevel={1}
        title="Task"
        subtitle="ดูงานทั้งหมดในวอร์ดที่รับผิดชอบ พร้อม quick action สำหรับ done, blocked, และ reassign"
      >
        {data.blockedByMissingWard ? (
          <SetupNotice
            title="Student ward assignment required"
            body="รอ admin assign ward ให้ก่อน จึงจะเห็นและจัดการ task ได้"
          />
        ) : (
          <>
            <ExpandableFilters title="Filter tasks">
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
                  label="Responsible"
                  className="col-span-2 lg:col-span-1"
                  labelClassName="mb-1 text-[11px] tracking-[0.12em] md:mb-1.5 md:text-xs"
                >
                  <SelectBox
                    name="ownerId"
                    defaultValue={params.ownerId ?? ""}
                    className="px-3.5 py-2.5 text-[13px] md:px-4 md:py-3 md:text-sm"
                  >
                    <StaffOptions profiles={data.profiles} />
                  </SelectBox>
                </Field>
                <div className="col-span-2 flex items-end lg:col-span-1">
                  <SubmitButton>Apply filters</SubmitButton>
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
              <EmptyState
                title="No tasks in view"
                body="ลองปรับ filter หรือสร้างงานใหม่ผ่าน quick task entry หรือหน้า patient"
              />
            )}
          </>
        )}
      </GlassPanel>
    </div>
  );
}
