import { progressNoteText } from "@/lib/progress-format";
import type {
  ActivityLog,
  HandoverNote,
  Patient,
  Problem,
  SummaryNotePayload,
  SummaryNoteProblemEntry,
  SummaryNoteSection,
  TaskWithUpdates,
  Ward,
} from "@/lib/types";
import {
  labelForProblemDiagnosisStatus,
  labelForProblemPriority,
  labelForTaskPriority,
} from "@/lib/utils";

type SummaryNoteInput = {
  patient: Patient;
  ward: Ward | null;
  problems: Problem[];
  tasks: TaskWithUpdates[];
  handover: HandoverNote | null;
  activity: ActivityLog[];
};

function splitBullets(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n|[|]/)
    .map((item) => item.trim().replace(/^[*-]\s+/, ""))
    .filter((item) => item && item !== "-");
}

function presentItems(items: (string | null | undefined)[]): string[] {
  return items.filter((item): item is string => Boolean(item?.trim()) && item?.trim() !== "-");
}

function labeledValue(label: string, value: string | number | null | undefined) {
  const text = value == null ? "" : String(value).trim();
  return text && text !== "-" ? `${label} ${text}` : null;
}

function makeSection(heading: string, bullets: (string | null | undefined)[]): SummaryNoteSection {
  return {
    heading,
    bullets: presentItems(bullets),
  };
}

function noteDateParts(now = new Date()) {
  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(now);

  return { fileLabel: dateLabel, dateLabel };
}

function getAdmitDate(activity: ActivityLog[]) {
  const created = [...activity]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .find((item) => item.action === "patient.created");
  return created?.createdAt ?? null;
}

function taskMetadataParts(task: TaskWithUpdates) {
  return [
    labelForTaskPriority(task.priority),
    labeledValue("Owner:", task.ownerName),
    task.dueAt ? `Due: ${task.dueAt.slice(0, 10)}` : null,
    labeledValue("Blocked:", task.blockedReason),
  ];
}

function formatTaskLine(task: TaskWithUpdates) {
  return [task.title, ...taskMetadataParts(task)].filter(Boolean).join(" | ");
}

function formatTaskLineWithProblem(task: TaskWithUpdates, problemName: string) {
  return [task.title, labeledValue("Problem:", problemName), ...taskMetadataParts(task)]
    .filter(Boolean)
    .join(" | ");
}

function buildOrderedTaskLines(tasks: TaskWithUpdates[], problems: Problem[]) {
  const incompleteTasks = tasks.filter((task) => task.status !== "done");
  const lines: string[] = [];
  const linkedProblemIds = new Set<string>();

  for (const problem of problems) {
    linkedProblemIds.add(problem.id);
    for (const task of incompleteTasks) {
      if (task.problemId === problem.id) {
        lines.push(formatTaskLineWithProblem(task, problem.problemName));
      }
    }
  }

  for (const task of incompleteTasks) {
    if (!task.problemId || !linkedProblemIds.has(task.problemId)) {
      lines.push(formatTaskLine(task));
    }
  }

  return lines;
}

function buildProblemEntry(problem: Problem): SummaryNoteProblemEntry {
  const latestEntry = problem.latestEntry;
  return {
    id: problem.id,
    problemName: problem.problemName,
    priority: problem.priority,
    diagnosisStatus: problem.diagnosisStatus,
    currentSummary: splitBullets(problem.currentStatusSummary),
    latestNote: splitBullets(progressNoteText(latestEntry?.note)),
    pendingTasks: problem.linkedTasks.filter((task) => task.status !== "done").map(formatTaskLine),
  };
}

function buildPlainText(payload: Omit<SummaryNotePayload, "plainText">, patient: Patient) {
  const lines: string[] = [];

  const pushSection = (section: SummaryNoteSection) => {
    if (!section.bullets.length) return;
    lines.push(`${section.heading}:`);
    for (const bullet of section.bullets) {
      lines.push(`- ${bullet}`);
    }
    lines.push("");
  };

  lines.push(payload.heading);
  lines.push("(Off Service Note / Summary Note)");
  lines.push("");

  const identification = presentItems([
    labeledValue("ชื่อ", patient.displayName),
    patient.age == null ? null : `อายุ ${patient.age} ปี`,
  ]).join(" ");
  lines.push(...presentItems([
    identification,
    patient.hospitalNumber,
    labeledValue("U/D", patient.underlyingDisease),
  ]));
  lines.push("");
  pushSection(payload.summaryDate);
  pushSection(payload.briefBackground);
  pushSection(payload.reasonForAdmission);
  pushSection(payload.hospitalCourse);

  if (payload.activeProblems.length) {
    lines.push("Active Problem List:");
    payload.activeProblems.forEach((problem, index) => {
      lines.push(
        `${index + 1}. ${problem.problemName} [${labelForProblemPriority(problem.priority)} | ${labelForProblemDiagnosisStatus(problem.diagnosisStatus)}]`,
      );
      if (problem.currentSummary.length) lines.push(`   Current Summary: ${problem.currentSummary.join(" | ")}`);
      if (problem.latestNote.length) lines.push(`   Latest Note: ${problem.latestNote.join(" | ")}`);
      if (problem.pendingTasks.length) lines.push(`   Pending Ward work: ${problem.pendingTasks.join(" | ")}`);
    });
  }
  lines.push("");

  pushSection(makeSection("Resolved / Chronic Problems", payload.resolvedProblems));
  pushSection(makeSection("Consultations", payload.consultations));
  pushSection(makeSection("Pending Issues", payload.pendingIssues));
  pushSection(makeSection("Safety Alerts", payload.safetyAlerts));
  pushSection(makeSection("Ward work", payload.tasks));

  return lines.join("\n").trim();
}

export function buildSummaryNotePayload(input: SummaryNoteInput): SummaryNotePayload {
  const { patient, problems, tasks, handover, activity } = input;
  const { fileLabel, dateLabel } = noteDateParts();
  const admitDate = getAdmitDate(activity);
  const activeProblems = problems
    .filter((problem) => problem.priority !== "RESOLVED_CHRONIC" && !problem.resolvedAt)
    .map(buildProblemEntry);
  const resolvedProblems = problems
    .filter((problem) => problem.priority === "RESOLVED_CHRONIC" || Boolean(problem.resolvedAt))
    .map((problem) => presentItems([problem.problemName, problem.currentStatusSummary]).join(" | "));
  const consultTasks = tasks.filter((task) => task.type === "consult");
  const incompleteTasks = tasks.filter((task) => task.status !== "done");
  const orderedTasks = buildOrderedTaskLines(tasks, problems);
  const pendingIssues = [
    ...problems.flatMap((problem) =>
      problem.linkedTasks.filter((task) => task.status !== "done").map((task) => task.title),
    ),
    ...(handover?.note ? [handover.note] : []),
  ];
  const safetyAlerts = [
    labeledValue("Allergy:", patient.allergy),
    patient.precaution !== "none" ? labeledValue("Infection risk:", patient.precaution) : null,
    ...problems
      .filter((problem) => problem.priority === "ACTIVE_UNSTABLE")
      .map((problem) => `Deterioration warning: ${problem.problemName}`),
    ...tasks
      .filter((task) => task.type === "medication" && task.priority !== "normal")
      .map((task) => `High-risk medication ward work: ${task.title}`),
    ...tasks
      .filter((task) => task.type === "procedure" && task.status !== "done")
      .map((task) => `Procedure risk: ${task.title}`),
  ].filter((value): value is string => Boolean(value));

  const payloadWithoutText = {
    patientId: patient.id,
    patientLabel: patient.displayName,
    fileLabel,
    dateLabel,
    heading: "Progress Note",
    patientFacts: makeSection("Patient", [
      labeledValue("Name:", patient.displayName),
      labeledValue("HN:", patient.hospitalNumber),
      labeledValue("Age/Sex:", presentItems([patient.age == null ? null : String(patient.age), patient.sex]).join(" / ")),
      labeledValue("Admission date:", admitDate?.slice(0, 10)),
      labeledValue("Attending:", patient.responsibleDoctorName),
    ]),
    summaryDate: makeSection("Summary Date", [`Date: ${dateLabel}`]),
    briefBackground: makeSection("Brief Background", [
      labeledValue("Relevant underlying diseases:", patient.underlyingDisease),
    ]),
    reasonForAdmission: makeSection("Reason for Admission", [
      patient.diagnosis,
      handover?.note,
    ]),
    hospitalCourse: makeSection(
      "Hospital Course",
      problems.map((problem) =>
        presentItems([
          problem.problemName,
          problem.currentStatusSummary,
          progressNoteText(problem.latestEntry?.note),
        ]).join(" | "),
      ),
    ),
    activeProblems,
    resolvedProblems,
    consultations: presentItems(consultTasks.map((task) => task.title)),
    pendingIssues: presentItems(pendingIssues),
    safetyAlerts,
    tasks: orderedTasks.length ? orderedTasks : incompleteTasks.map(formatTaskLine),
  };

  return {
    ...payloadWithoutText,
    plainText: buildPlainText(payloadWithoutText, patient),
  };
}
