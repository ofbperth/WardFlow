import Link from "next/link";
import { exportSummaryNoteGoogleDocsAction } from "@/app/actions";
import { CopyTextButton, PendingSubmitButton } from "@/components/form-feedback";
import { EmptyState, SetupNotice } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getSummaryNotePayloadByPatientId } from "@/lib/wardflow";
import { labelForProblemDiagnosisStatus, labelForProblemPriority } from "@/lib/utils";
import styles from "./summary-note.module.css";

export default async function SummaryNotePage({ params, searchParams }: {
  params: Promise<{ patientId: string }>;
  searchParams?: Promise<{ export?: string; message?: string }>;
}) {
  const session = await requireAppSession();
  const { patientId } = await params;
  const query = (await searchParams) ?? {};
  const payload = await getSummaryNotePayloadByPatientId(session, patientId);

  if (!payload) {
    return <EmptyState title="Patient not found" body="Unavailable in your current scope." />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href={`/patients/${patientId}`} className={styles.back}>Back to patient</Link>
        <div className={styles.titleRow}>
          <div className={styles.titleBlock}>
            <h1>Summary note</h1>
            <p>{payload.patientLabel} <span aria-hidden="true">·</span> {payload.dateLabel}</p>
          </div>
          <div className={styles.actions}>
            <CopyTextButton text={payload.plainText} className={styles.control} />
            <form action={exportSummaryNoteGoogleDocsAction}>
              <input type="hidden" name="patientId" value={patientId} />
              <PendingSubmitButton pendingLabel="Exporting…" className={styles.control}>
                Export to Google Docs
              </PendingSubmitButton>
            </form>
          </div>
        </div>
      </header>

      {query.export === "error" && query.message ? (
        <SetupNotice title="Google Docs export unavailable" body={query.message} />
      ) : null}

      <article className={styles.document} aria-label="Summary note preview">
        <NoteSection title={payload.patientFacts.heading} items={payload.patientFacts.bullets} />
        <NoteSection title={payload.summaryDate.heading} items={payload.summaryDate.bullets} />
        <NoteSection title={payload.briefBackground.heading} items={payload.briefBackground.bullets} />
        <NoteSection title={payload.reasonForAdmission.heading} items={payload.reasonForAdmission.bullets} />
        <NoteSection title={payload.hospitalCourse.heading} items={payload.hospitalCourse.bullets} />

        {payload.activeProblems.length > 0 ? (
          <section className={styles.section}>
            <h2>Active Problem List</h2>
            <ol className={styles.problems}>
              {payload.activeProblems.map((problem) => (
                <li key={problem.id} className={styles.problem}>
                  <h3>{problem.problemName}</h3>
                  <p className={styles.metadata}>
                    {labelForProblemPriority(problem.priority)} · {labelForProblemDiagnosisStatus(problem.diagnosisStatus)}
                  </p>
                  <NoteMini title="Current Summary" items={problem.currentSummary} />
                  {problem.latestNote.length ? <div className={styles.detail}>
                    <h4>Latest Note</h4>
                    <div className="whitespace-pre-wrap break-words">
                      {problem.latestNote.map((line, index) => <div key={index}>{line}</div>)}
                    </div>
                  </div> : null}
                  <NoteMini title="Pending Ward work" items={problem.pendingTasks} />
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <NoteSection title="Resolved / Chronic Problems" items={payload.resolvedProblems} />
        <NoteSection title="Consultations" items={payload.consultations} />
        <NoteSection title="Pending Issues" items={payload.pendingIssues} />
        <NoteSection title="Safety Alerts" items={payload.safetyAlerts} />
        <NoteSection title="Ward work" items={payload.tasks} />
      </article>

      <details className={styles.plainText}>
        <summary>Plain text</summary>
        <div className={styles.plainTextBody}>
          <div className={styles.textActions}>
            <label htmlFor="summary-note-text">Select or copy note</label>
            <CopyTextButton text={payload.plainText} className={styles.control} />
          </div>
          <textarea id="summary-note-text" readOnly value={payload.plainText} spellCheck={false} />
        </div>
      </details>
    </div>
  );
}

function NoteSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      <ul className={styles.lines}>
        {items.map((item, index) => <li key={`${title}-${index}`} className="whitespace-pre-wrap break-words">{item}</li>)}
      </ul>
    </section>
  );
}

function NoteMini({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className={styles.detail}>
      <h4>{title}</h4>
      <ul className={styles.lines}>
        {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    </div>
  );
}
