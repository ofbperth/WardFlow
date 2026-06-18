import Link from "next/link";
import { bulkCreateTasksAction } from "@/app/actions";
import { AppFeedbackToast } from "@/components/app-feedback-toast";
import { BulkTaskEntryBuilder } from "@/components/bulk-task-entry-builder";
import { GlassPanel, SetupNotice } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getBulkTaskEntryData } from "@/lib/wardflow";

export default async function BulkTaskPage({
  searchParams,
}: {
  searchParams?: Promise<{ toast?: string }>;
}) {
  const session = await requireAppSession();
  const params = (await searchParams) ?? {};
  const data = await getBulkTaskEntryData(session);

  return (
    <div className="space-y-6">
      <AppFeedbackToast toastKey={params.toast} />

      <GlassPanel
        title="Bulk task entry"
        subtitle="สร้างหลาย task ให้หลาย patient ใน submit เดียว โดยยังคุม ward access ตามสิทธิ์เดิม"
        action={
          <Link
            href="/my-tasks"
            className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-foreground"
          >
            Back to Task
          </Link>
        }
      >
        {data.blockedByMissingWard ? (
          <SetupNotice
            title="Student ward assignment required"
            body="รอ admin assign ward ให้ก่อน จึงจะใช้ bulk task entry ได้"
          />
        ) : (
          <BulkTaskEntryBuilder
            wardSummaries={data.wardSummaries}
            templates={data.templates}
            profilesByWard={data.profilesByWard}
            defaultWardId={data.defaultWardId}
            submitAction={bulkCreateTasksAction}
          />
        )}
      </GlassPanel>
    </div>
  );
}
