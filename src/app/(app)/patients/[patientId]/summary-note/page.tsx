import Link from "next/link";
import { exportSummaryNoteGoogleDocsAction } from "@/app/actions";
import { CopyTextButton, PendingSubmitButton } from "@/components/form-feedback";
import { EmptyState, SetupNotice } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getSummaryNotePayloadByPatientId } from "@/lib/wardflow";
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
        <section className={styles.section}>
          {payload.identification ? <p className={styles.identity}>{payload.identification}</p> : null}
          {payload.underlyingDisease ? (
            <p className={styles.noteText}>U/D {payload.underlyingDisease}</p>
          ) : null}
        </section>
        {payload.hospitalCourse.length ? (
          <section className={styles.section}>
            <h2>Hospital Course:</h2>
            <ul className={styles.problems}>
              {payload.hospitalCourse.map(problem => (
                <li key={problem.id} className={styles.problem}>
                  <h3>#{problem.problemName}</h3>
                  {problem.latestNote ? <p className={styles.noteText}>{problem.latestNote}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
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
