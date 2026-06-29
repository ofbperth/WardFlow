import Link from "next/link";
import { notFound } from "next/navigation";
import { quickCreateTasksAction } from "@/app/actions";
import { AppFeedbackToast } from "@/components/app-feedback-toast";
import { BulkTaskEntryBuilder } from "@/components/bulk-task-entry-builder";
import { PageHeader, SetupNotice } from "@/components/wardflow-ui";
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
    <div className="space-y-4 md:space-y-6">
      <AppFeedbackToast toastKey={query.toast} />
      <PageHeader
        title="Quick task entry"
        action={
          <Link href="/tasks/quick" className="button-secondary rounded-full px-4 py-2 text-sm font-semibold">
            Change ward
          </Link>
        }
      />

      {data.blockedByMissingWard ? (
        <SetupNotice title="Student ward assignment required" body="Ask admin to assign a ward first." />
      ) : wardSummary ? (
        <BulkTaskEntryBuilder
          wardSummary={wardSummary}
          templates={data.templates}
          profiles={data.profilesByWard[wardSummary.ward.id] ?? []}
          submitAction={quickCreateTasksAction}
        />
      ) : null}
    </div>
  );
}
