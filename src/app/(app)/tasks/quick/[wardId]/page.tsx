import Link from "next/link";
import { notFound } from "next/navigation";
import { quickCreateTasksAction } from "@/app/actions";
import { AppFeedbackToast } from "@/components/app-feedback-toast";
import { BulkTaskEntryBuilder } from "@/components/bulk-task-entry-builder";
import { GlassPanel, SetupNotice } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getBulkTaskEntryData } from "@/lib/wardflow";

export default async function QuickTaskEntryWardPage({
  params,
  searchParams,
}: {
  params: Promise<{ wardId: string }>;
  searchParams?: Promise<{ toast?: string }>;
}) {
  const session = await requireAppSession();
  const routeParams = await params;
  const query = (await searchParams) ?? {};
  const data = await getBulkTaskEntryData(session);
  const wardSummary = data.wardSummaries.find((summary) => summary.ward.id === routeParams.wardId);

  if (!data.blockedByMissingWard && !wardSummary) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <AppFeedbackToast toastKey={query.toast} />

      <GlassPanel
        headingLevel={1}
        title="Quick task entry"
        subtitle={
          wardSummary
            ? `สร้างหลาย task ใน ${wardSummary.ward.name} ได้ในหน้าเดียว โดยยังคุม ward access ตามสิทธิ์เดิม`
            : "สร้างหลาย task ได้เร็วขึ้นใน ward ที่ได้รับมอบหมาย"
        }
        action={
          <Link
            href="/tasks/quick"
            className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-foreground"
          >
            Change ward
          </Link>
        }
      >
        {data.blockedByMissingWard ? (
          <SetupNotice
            title="Student ward assignment required"
            body="รอ admin assign ward ให้ก่อน จึงจะใช้ quick task entry ได้"
          />
        ) : wardSummary ? (
          <BulkTaskEntryBuilder
            wardSummary={wardSummary}
            templates={data.templates}
            profiles={data.profilesByWard[wardSummary.ward.id] ?? []}
            submitAction={quickCreateTasksAction}
          />
        ) : null}
      </GlassPanel>
    </div>
  );
}
