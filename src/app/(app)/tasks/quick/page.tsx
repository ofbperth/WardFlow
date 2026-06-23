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
  const wardCount = data.wardSummaries.length;
  const patientCount = data.wardSummaries.reduce((total, summary) => total + summary.patients.length, 0);

  return (
    <div className="space-y-6">
      <AppFeedbackToast toastKey={params.toast} />

      <GlassPanel
        headingLevel={1}
        title="Quick task entry"
        className="overflow-hidden"
      >
        {data.blockedByMissingWard ? (
          <SetupNotice title="Student ward assignment required" body="รอ admin assign ward ก่อน" />
        ) : data.wardSummaries.length ? (
          <div className="space-y-5">
            <section className="grid gap-3 border-b clinical-divider pb-5 md:grid-cols-3">
              <QuickEntryMetric label="Wards ready" value={wardCount} />
              <QuickEntryMetric label="Patients in scope" value={patientCount} />
              <QuickEntryMetric label="Entry mode" value="1-step" />
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              {data.wardSummaries.map((summary) => (
                <Link
                  key={summary.ward.id}
                  href={`/tasks/quick/${summary.ward.id}`}
                  className="group rounded-[28px] border clinical-divider bg-white p-5 transition hover:border-mint-300 hover:bg-mint-50/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-[1.45rem] font-semibold text-foreground">{summary.ward.name}</h3>
                    </div>
                    <div className="rounded-full border border-mint-200 bg-mint-50 px-3 py-1.5 text-xs font-semibold text-mint-700">
                      {summary.patients.length} active
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[22px] bg-[var(--surface-muted)] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Patients</p>
                      <p className="mt-2 text-base font-semibold text-foreground">{summary.patients.length} ready now</p>
                    </div>
                    <div className="rounded-[22px] bg-[var(--surface-muted)] px-4 py-3 md:col-span-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Best for</p>
                      <p className="mt-2 text-sm leading-6 text-foreground/85">Follow-up, consult, procedure prep</p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t clinical-divider pt-4">
                    <span className="inline-flex items-center rounded-full bg-mint-600 px-4 py-2 text-sm font-semibold text-white">
                      Enter workspace
                    </span>
                  </div>
                </Link>
              ))}
            </section>
          </div>
        ) : (
          <EmptyState title="No ward available" body="ยังไม่มี ward ที่คุณเข้าถึงได้" />
        )}
      </GlassPanel>
    </div>
  );
}

function QuickEntryMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-[24px] bg-[var(--surface-muted)] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 font-display text-[1.8rem] font-semibold leading-none text-foreground">{value}</p>
    </div>
  );
}
