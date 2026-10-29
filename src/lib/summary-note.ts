import { progressNoteText } from "@/lib/progress-format";
import type { Patient, Problem, SummaryNotePayload } from "@/lib/types";

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
  // Keep recorded order and resolved problems in the hospital course.
  // Cleared latest notes must never fall back to old notes or status summaries.
  const hospitalCourse = problems.map(problem => ({
    id: problem.id,
    problemName: problem.problemName,
    latestNote: present(progressNoteText(problem.latestEntry?.note)),
  }));
  const background = [identification, underlyingDisease ? `U/D ${underlyingDisease}` : ""]
    .filter(Boolean).join("\n");
  const course = hospitalCourse.length ? [
    "Hospital Course:",
    ...hospitalCourse.map(problem => [
      `#${problem.problemName}`, problem.latestNote,
    ].filter(Boolean).join("\n")),
  ].join("\n\n") : "";

  return {
    patientId: patient.id,
    patientLabel: patient.displayName,
    fileLabel: dateLabel,
    dateLabel,
    identification,
    underlyingDisease,
    hospitalCourse,
    plainText: [background, course].filter(Boolean).join("\n\n"),
  };
}
