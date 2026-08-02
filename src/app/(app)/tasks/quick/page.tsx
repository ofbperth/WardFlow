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
      <PageHeader compact title="Quick task entry" />

      {data.blockedByMissingWard ? (
        <SetupNotice title="Ward assignment required" body="Ask an admin to assign one or more Wards first." />
      ) : data.wardSummaries.length ? (
        <section className="grid gap-3 xl:grid-cols-2">
          {data.wardSummaries.map((summary) => (
            <Link
              key={summary.ward.id}
              href={`/tasks/quick/${summary.ward.id}`}
              className="group panel-surface rounded-[22px] p-4 transition hover:border-[color:var(--color-accent)]/30 hover:bg-[color:var(--color-accent-soft)]/35"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Ward</p>
                  <h3 className="mt-1.5 text-[1.2rem] font-semibold text-foreground">{summary.ward.name}</h3>
                </div>
                <div className="rounded-full border border-[color:var(--color-rule)] bg-[color:var(--color-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-accent-strong)]">
                  {summary.patients.length} active
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t clinical-divider pt-3">
                <p className="text-sm text-muted">Open this ward and start adding quick tasks.</p>
                <span className="button-accent inline-flex items-center whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold">
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
