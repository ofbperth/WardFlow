import Link from "next/link";
import { AppFeedbackToast } from "@/components/app-feedback-toast";
import { EmptyState, PageHeader, SetupNotice } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getBulkTaskEntryData } from "@/lib/wardflow";

export default async function QuickTaskEntryLandingPage({
  searchParams,
}: {
  searchParams?: Promise<{ toast?: string }>;
}) {
  const session = await requireAppSession();
  const params = (await searchParams) ?? {};
  const data = await getBulkTaskEntryData(session);

  return (
    <div className="space-y-4 md:space-y-6">
      <AppFeedbackToast toastKey={params.toast} />
      <PageHeader title="Quick task entry" />

      {data.blockedByMissingWard ? (
        <SetupNotice title="Student ward assignment required" body="Ask admin to assign a ward first." />
      ) : data.wardSummaries.length ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {data.wardSummaries.map((summary) => (
            <Link
              key={summary.ward.id}
              href={`/tasks/quick/${summary.ward.id}`}
              className="group panel-surface rounded-[28px] p-5 transition hover:border-[color:var(--color-accent)]/30 hover:bg-[color:var(--color-accent-soft)]/35"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Ward</p>
                  <h3 className="mt-2 text-[1.45rem] font-semibold text-foreground">{summary.ward.name}</h3>
                </div>
                <div className="rounded-full border border-[color:var(--color-rule)] bg-[color:var(--color-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-accent-strong)]">
                  {summary.patients.length} active
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t clinical-divider pt-4">
                <p className="text-sm text-muted">Open this ward and start adding quick tasks immediately.</p>
                <span className="button-accent inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold">
                  Enter workspace
                </span>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <EmptyState title="No ward available" body="No ward is available in your current scope." />
      )}
    </div>
  );
}
