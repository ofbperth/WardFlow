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
  const profileCount = wardSummary ? (data.profilesByWard[wardSummary.ward.id] ?? []).length : 0;

  if (!data.blockedByMissingWard && !wardSummary) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <AppFeedbackToast toastKey={query.toast} />

      <GlassPanel
        headingLevel={1}
        title="Quick task entry"
        action={
          <Link
            href="/tasks/quick"
            className="rounded-full border clinical-divider bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-[var(--surface-muted)]"
          >
            Change ward
          </Link>
        }
        className="overflow-hidden"
      >
        {data.blockedByMissingWard ? (
          <SetupNotice title="Student ward assignment required" body="รอ admin assign ward ก่อน" />
        ) : wardSummary ? (
          <div className="space-y-4">
            <section className="grid gap-2.5 border-b clinical-divider pb-4 md:grid-cols-4">
              <WardEntryMetric label="Selected ward" value={wardSummary.ward.name} />
              <WardEntryMetric
                label="Patients"
                value={`${wardSummary.patients.length}`}
              />
              <WardEntryMetric label="Templates" value={`${data.templates.length}`} />
              <WardEntryMetric label="Assignable staff" value={`${profileCount}`} />
            </section>

            <BulkTaskEntryBuilder
              wardSummary={wardSummary}
              templates={data.templates}
              profiles={data.profilesByWard[wardSummary.ward.id] ?? []}
              submitAction={quickCreateTasksAction}
            />
          </div>
        ) : null}
      </GlassPanel>
    </div>
  );
}

function WardEntryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] bg-[var(--surface-muted)] px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold leading-none text-foreground">{value}</p>
    </div>
  );
}
