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
import { labelForProblemPriority, labelForTaskPriority } from "@/lib/utils";

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
    .map((item) => item.trim().replace(/^[*-]\s*/, ""))
    .filter(Boolean);
}

function withFallback(items: string[], fallback = "-") {
  return items.length ? items : [fallback];
}

function makeSection(heading: string, bullets: string[]): SummaryNoteSection {
  return {
    heading,
    bullets: withFallback(bullets),
  };
}

function noteDateParts(now = new Date()) {
  const fileLabel = now.toISOString().slice(0, 10);
  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(now);

  return { fileLabel, dateLabel };
}

function getAdmitDate(activity: ActivityLog[]) {
  const created = [...activity]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .find((item) => item.action === "patient.created");
  return created?.createdAt ?? activity[activity.length - 1]?.createdAt ?? null;
}

function taskMetadataParts(task: TaskWithUpdates) {
  return [
    labelForTaskPriority(task.priority),
    task.ownerName ? `Owner: ${task.ownerName}` : "Owner: Unassigned",
    task.dueAt ? `Due: ${task.dueAt.slice(0, 10)}` : null,
    task.blockedReason ? `Blocked: ${task.blockedReason}` : null,
  ];
}

function formatTaskLine(task: TaskWithUpdates) {
  const parts = [task.title, ...taskMetadataParts(task)];

  return parts.filter(Boolean).join(" | ");
}

function formatTaskLineWithProblem(task: TaskWithUpdates, problemTitle: string) {
  return [task.title, `Problem: ${problemTitle}`, ...taskMetadataParts(task)].filter(Boolean).join(" | ");
}

function buildOrderedTaskLines(tasks: TaskWithUpdates[], problems: Problem[]) {
  const incompleteTasks = tasks.filter((task) => task.status !== "done");
  const lines: string[] = [];
  const linkedProblemIds = new Set<string>();

  for (const problem of problems) {
    linkedProblemIds.add(problem.id);
    for (const task of incompleteTasks) {
      if (task.problemId === problem.id) {
        lines.push(formatTaskLineWithProblem(task, problem.title));
      }
    }
  }

  for (const task of incompleteTasks) {
    if (!task.problemId || !linkedProblemIds.has(task.problemId)) {
      lines.push(formatTaskLineWithProblem(task, "No linked problem"));
    }
  }

  return lines;
}

function buildProblemEntry(problem: Problem, tasks: TaskWithUpdates[]): SummaryNoteProblemEntry {
  return {
    id: problem.id,
    title: problem.title,
    priority: problem.priority,
    status: withFallback(splitBullets(problem.currentStatus ?? problem.keyData)),
    evidence: withFallback(splitBullets(problem.evidence ?? problem.keyData)),
    treatment: withFallback(splitBullets(problem.treatment)),
    reasoning: withFallback(splitBullets(problem.reasoning)),
    todayPlan: withFallback(splitBullets(problem.todayPlan ?? problem.plan)),
    pendingTasks: withFallback(tasks.filter((task) => task.status !== "done").map(formatTaskLine)),
  };
}

function buildPlainText(payload: Omit<SummaryNotePayload, "plainText">) {
  const lines: string[] = [];

  const pushSection = (section: SummaryNoteSection) => {
    lines.push(`${section.heading}:`);
    for (const bullet of section.bullets) {
      lines.push(`- ${bullet}`);
    }
    lines.push("");
  };

  lines.push(payload.heading);
  lines.push("(Off Service Note / Summary Note)");
  lines.push("");

  pushSection(payload.patientFacts);
  pushSection(payload.summaryDate);
  pushSection(payload.briefBackground);
  pushSection(payload.reasonForAdmission);
  pushSection(payload.hospitalCourse);

  lines.push("Active Problem List:");
  if (payload.activeProblems.length === 0) {
    lines.push("- None");
  } else {
    payload.activeProblems.forEach((problem, index) => {
      lines.push(`${index + 1}. ${problem.title} [${labelForProblemPriority(problem.priority)}]`);
      lines.push(`   Status: ${problem.status.join(" | ")}`);
      lines.push(`   Evidence: ${problem.evidence.join(" | ")}`);
      lines.push(`   Treatment: ${problem.treatment.join(" | ")}`);
      lines.push(`   Reasoning: ${problem.reasoning.join(" | ")}`);
      lines.push(`   Today's Plan: ${problem.todayPlan.join(" | ")}`);
      lines.push(`   Pending Tasks: ${problem.pendingTasks.join(" | ")}`);
    });
  }
  lines.push("");

  lines.push("Resolved / Chronic Problems:");
  for (const bullet of withFallback(payload.resolvedProblems)) {
    lines.push(`- ${bullet}`);
  }
  lines.push("");

  lines.push("Consultations:");
  for (const bullet of withFallback(payload.consultations)) {
    lines.push(`- ${bullet}`);
  }
  lines.push("");

  lines.push("Pending Issues:");
  for (const bullet of withFallback(payload.pendingIssues)) {
    lines.push(`- ${bullet}`);
  }
  lines.push("");

  lines.push("Suggested Plan:");
  for (const bullet of withFallback(payload.suggestedPlan)) {
    lines.push(`- ${bullet}`);
  }
  lines.push("");

  lines.push("Safety Alerts:");
  for (const bullet of withFallback(payload.safetyAlerts)) {
    lines.push(`- ${bullet}`);
  }
  lines.push("");

  lines.push("Tasks:");
  for (const bullet of withFallback(payload.tasks)) {
    lines.push(`- ${bullet}`);
  }

  return lines.join("\n").trim();
}

export function buildSummaryNotePayload(input: SummaryNoteInput): SummaryNotePayload {
  const { patient, ward, problems, tasks, handover, activity } = input;
  const { fileLabel, dateLabel } = noteDateParts();
  const admitDate = getAdmitDate(activity);
  const activeProblems = problems
    .filter((problem) => problem.priority !== "RESOLVED_CHRONIC")
    .map((problem) =>
      buildProblemEntry(
        problem,
        tasks.filter((task) => task.problemId === problem.id),
      ),
    );
  const resolvedProblems = problems
    .filter((problem) => problem.priority === "RESOLVED_CHRONIC")
    .map((problem) => `${problem.title}${problem.currentStatus ? ` | ${problem.currentStatus}` : ""}`);
  const consultTasks = tasks.filter((task) => task.type === "consult");
  const incompleteTasks = tasks.filter((task) => task.status !== "done");
  const orderedTasks = buildOrderedTaskLines(tasks, problems);
  const pendingIssues = [
    ...problems.flatMap((problem) => splitBullets(problem.pending)),
    ...incompleteTasks.map(formatTaskLine),
  ];
  const suggestedPlan = [
    ...activeProblems.flatMap((problem) => problem.todayPlan.filter((item) => item !== "-")),
    ...(handover?.escalationInstruction ? [handover.escalationInstruction] : []),
  ];
  const safetyAlerts = [
    patient.allergy ? `Allergy: ${patient.allergy}` : null,
    patient.precaution !== "none" ? `Infection risk: ${patient.precaution}` : null,
    ...problems
      .filter((problem) => problem.priority === "ACTIVE_UNSTABLE")
      .map((problem) => `Deterioration warning: ${problem.title}`),
    ...tasks
      .filter((task) => task.type === "medication" && task.priority !== "normal")
      .map((task) => `High-risk medication task: ${task.title}`),
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
      `Name: ${patient.displayName}`,
      "HN: -",
      "AN: -",
      `Age/Sex: ${patient.age ?? "-"} / ${patient.sex ?? "-"}`,
      `Ward: ${ward?.name ?? "-"}`,
      `Admission date: ${admitDate ? admitDate.slice(0, 10) : "-"}`,
      `Attending: ${patient.responsibleDoctorName ?? "-"}`,
    ]),
    summaryDate: makeSection("Summary Date", [`Date: ${dateLabel}`]),
    briefBackground: makeSection("Brief Background", [
      "Baseline function: -",
      `Relevant underlying diseases: ${patient.underlyingDisease ?? "-"}`,
      `Important previous history: ${patient.codeStatus ?? "-"}`,
    ]),
    reasonForAdmission: makeSection("Reason for Admission", [
      patient.diagnosis,
      handover?.note ?? "Active inpatient ward-round follow-up.",
    ]),
    hospitalCourse: makeSection("Hospital Course", [
      ...problems.map((problem) =>
        [problem.title, problem.currentStatus ?? problem.keyData, problem.todayPlan ?? problem.plan]
          .filter(Boolean)
          .join(" | "),
      ),
    ]),
    activeProblems,
    resolvedProblems,
    consultations: consultTasks.length
      ? consultTasks.map((task) => task.title)
      : ["No active consultation task recorded"],
    pendingIssues,
    suggestedPlan,
    safetyAlerts,
    tasks: orderedTasks,
  };

  return {
    ...payloadWithoutText,
    plainText: buildPlainText(payloadWithoutText),
  };
}
