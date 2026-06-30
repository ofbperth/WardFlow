import Link from "next/link";
import { redirect } from "next/navigation";
import { exportSummaryNoteGoogleDocsAction } from "@/app/actions";
import { CopyTextButton } from "@/components/form-feedback";
import { EmptyState, GlassPanel, PageHeader, SetupNotice } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getSummaryNotePayloadByPatientId } from "@/lib/wardflow";
import { labelForProblemDiagnosisStatus, labelForProblemPriority } from "@/lib/utils";

export default async function SummaryNotePage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams?: Promise<{ export?: string; message?: string; docUrl?: string }>;
}) {
  const session = await requireAppSession();
  const { patientId } = await params;
  const query = (await searchParams) ?? {};
  const payload = await getSummaryNotePayloadByPatientId(session, patientId);

  if (!payload) {
    return <EmptyState title="Patient not found" body="Unavailable in your current scope." />;
  }

  if (query.export === "success" && query.docUrl) {
    redirect(query.docUrl);
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Summary Note Preview"
        subtitle={`${payload.patientLabel} | ${payload.fileLabel}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/patients/${patientId}`}
              className="button-secondary inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold"
            >
              Back to patient
            </Link>
            <form action={exportSummaryNoteGoogleDocsAction}>
              <input type="hidden" name="patientId" value={patientId} />
              <button
                type="submit"
                className="button-accent inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold"
              >
                Export to Google Docs
              </button>
            </form>
          </div>
        }
      />

      {query.export === "error" && query.message ? (
        <SetupNotice title="Google Docs export unavailable" body={query.message} />
      ) : null}

      <GlassPanel title="Structured Preview" action={<CopyTextButton text={payload.plainText} />}>
        <div className="space-y-5">
          <NoteSection title={payload.patientFacts.heading} items={payload.patientFacts.bullets} />
          <NoteSection title={payload.summaryDate.heading} items={payload.summaryDate.bullets} />
          <NoteSection title={payload.briefBackground.heading} items={payload.briefBackground.bullets} />
          <NoteSection
            title={payload.reasonForAdmission.heading}
            items={payload.reasonForAdmission.bullets}
          />
          <NoteSection title={payload.hospitalCourse.heading} items={payload.hospitalCourse.bullets} />

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Active Problem List</h2>
            {payload.activeProblems.length > 0 ? (
              payload.activeProblems.map((problem, index) => (
                <div key={problem.id} className="rounded-[22px] border clinical-divider bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-foreground">
                      {index + 1}. {problem.problemName}
                    </p>
                    <span className="inline-flex rounded-full border border-[color:var(--color-rule)] bg-[color:var(--color-paper-3)] px-3 py-1 text-xs font-semibold text-[color:var(--color-ink)]">
                      {labelForProblemPriority(problem.priority)} |{" "}
                      {labelForProblemDiagnosisStatus(problem.diagnosisStatus)}
                    </span>
                  </div>
                  <div className="mt-3 space-y-3">
                    <NoteMini title="Current Summary" items={problem.currentSummary} />
                    <NoteMini title="Latest Update" items={problem.latestUpdate} />
                    <NoteMini title="Evidence" items={problem.evidence} />
                    <NoteMini title="Treatment" items={problem.treatment} />
                    <NoteMini title="Reasoning" items={problem.reasoning} />
                    <NoteMini title="Today's Plan" items={problem.todayPlan} />
                    <NoteMini title="History" items={problem.history} />
                    <NoteMini title="Pending Tasks" items={problem.pendingTasks} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No active problem available for note generation.</p>
            )}
          </section>

          <NoteSection title="Resolved / Chronic Problems" items={payload.resolvedProblems} />
          <NoteSection title="Consultations" items={payload.consultations} />
          <NoteSection title="Pending Issues" items={payload.pendingIssues} />
          <NoteSection title="Suggested Plan" items={payload.suggestedPlan} />
          <NoteSection title="Safety Alerts" items={payload.safetyAlerts} />
          <NoteSection title="Tasks" items={payload.tasks} />
        </div>
      </GlassPanel>

      <GlassPanel title="Plain Text Preview">
        <textarea
          readOnly
          value={payload.plainText}
          className="min-h-[28rem] w-full rounded-[22px] border clinical-divider bg-white px-4 py-4 text-sm text-foreground outline-none"
        />
      </GlassPanel>
    </div>
  );
}

function NoteSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="rounded-[18px] border clinical-divider bg-white px-3 py-2 text-sm text-foreground">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function NoteMini({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="text-sm leading-6 text-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
