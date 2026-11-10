import { progressNoteText } from "@/lib/progress-format";
import type { Patient, Problem, SummaryNotePayload, SummaryNoteProblemEntry } from "@/lib/types";
import { problemIsResolved } from "@/lib/utils";

function present(value: string | null | undefined): string {
  return value?.trim() && value.trim() !== "-" ? value : "";
}

export function buildSummaryNotePayload({ patient, problems }: {
  patient: Patient;
  problems: Problem[];
}): SummaryNotePayload {
  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Bangkok",
  }).format(new Date());
  const identification = [
    present(patient.displayName),
    patient.age == null ? "" : `อายุ ${patient.age} ปี`,
    present(patient.hospitalNumber),
  ].filter(Boolean).join(" ");
  const underlyingDisease = present(progressNoteText(patient.underlyingDisease));
  const hospitalCourse: SummaryNoteProblemEntry[] = [];
  const resolvedChronic: SummaryNoteProblemEntry[] = [];
  // Cleared latest notes must never fall back to old notes or status summaries.
  for (const problem of problems) {
    const entries = problemIsResolved(problem) ? resolvedChronic : hospitalCourse;
    entries.push({
      id: problem.id,
      problemName: problem.problemName,
      latestNote: present(progressNoteText(problem.latestEntry?.note)),
    });
  }
  const problemSections = [
    { title: "Hospital Course:", problems: hospitalCourse },
    { title: "Resolved/Chronic", problems: resolvedChronic },
  ].filter(section => section.problems.length > 0);
  const background = [identification, underlyingDisease ? `U/D ${underlyingDisease}` : ""]
    .filter(Boolean).join("\n");
  const sections = problemSections.map(section => [
    section.title,
    ...section.problems.map(problem => [
      `#${problem.problemName}`, problem.latestNote,
    ].filter(Boolean).join("\n")),
  ].join("\n\n"));

  return {
    patientId: patient.id,
    patientLabel: patient.displayName,
    fileLabel: dateLabel,
    dateLabel,
    identification,
    underlyingDisease,
    problemSections,
    plainText: [background, ...sections].filter(Boolean).join("\n\n"),
  };
}
