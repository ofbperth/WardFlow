import Link from "next/link";
import { AppFeedbackToast } from "@/components/app-feedback-toast";
import { EmptyState, GlassPanel, SetupNotice } from "@/components/wardflow-ui";
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
    <div className="space-y-6">
      <AppFeedbackToast toastKey={params.toast} />

      <GlassPanel headingLevel={1} title="Quick task entry" className="overflow-hidden">
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
                    <h3 className="text-[1.45rem] font-semibold text-foreground">{summary.ward.name}</h3>
                  </div>
                  <div className="rounded-full border border-[color:var(--color-rule)] bg-[color:var(--color-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-accent-strong)]">
                    {summary.patients.length} active
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[22px] bg-[color:var(--color-paper-3)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Patients</p>
                    <p className="mt-2 text-base font-semibold text-foreground">{summary.patients.length} ready now</p>
                  </div>
                  <div className="rounded-[22px] bg-[color:var(--color-paper-3)] px-4 py-3 md:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Best for</p>
                    <p className="mt-2 text-sm leading-6 text-foreground/85">Follow-up, consult, procedure prep</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t clinical-divider pt-4">
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
      </GlassPanel>
    </div>
  );
}
