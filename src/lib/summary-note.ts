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
  return [task.title, ...taskMetadataParts(task)].filter(Boolean).join(" | ");
}

function formatTaskLineWithProblem(task: TaskWithUpdates, problemName: string) {
  return [task.title, `Problem: ${problemName}`, ...taskMetadataParts(task)]
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
      lines.push(formatTaskLineWithProblem(task, "No linked problem"));
    }
  }

  return lines;
}

function buildProblemHistory(problem: Problem) {
  if (!problem.historyEntries.length) {
    return ["No historical progress entry yet"];
  }

  return problem.historyEntries.map((entry) =>
    [
      entry.dateTime.slice(0, 16).replace("T", " "),
      entry.statusUpdate ? `Status: ${entry.statusUpdate}` : null,
      entry.newEvidence ? `Evidence: ${entry.newEvidence}` : null,
      entry.treatmentChange ? `Treatment: ${entry.treatmentChange}` : null,
      entry.reasoningUpdate ? `Reasoning: ${entry.reasoningUpdate}` : null,
      entry.todayPlan ? `Plan: ${entry.todayPlan}` : null,
      entry.pendingTaskIds.length ? `Pending tasks: ${entry.pendingTaskIds.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" | "),
  );
}

function buildProblemEntry(problem: Problem): SummaryNoteProblemEntry {
  const latestEntry = problem.latestEntry;
  return {
    id: problem.id,
    problemName: problem.problemName,
    priority: problem.priority,
    diagnosisStatus: problem.diagnosisStatus,
    currentSummary: withFallback(
      [
        `${labelForProblemDiagnosisStatus(problem.diagnosisStatus)} diagnosis`,
        ...splitBullets(problem.currentStatusSummary),
      ],
      "No current summary",
    ),
    latestUpdate: withFallback(splitBullets(latestEntry?.statusUpdate), "No latest update"),
    evidence: withFallback(splitBullets(latestEntry?.newEvidence), "No new evidence"),
    treatment: withFallback(splitBullets(latestEntry?.treatmentChange), "No treatment change"),
    reasoning: withFallback(splitBullets(latestEntry?.reasoningUpdate), "No reasoning update"),
    todayPlan: withFallback(splitBullets(latestEntry?.todayPlan), "No today's plan"),
    history: withFallback(buildProblemHistory(problem), "No history"),
    pendingTasks: withFallback(
      problem.linkedTasks.filter((task) => task.status !== "done").map(formatTaskLine),
      "No linked pending task",
    ),
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
      lines.push(
        `${index + 1}. ${problem.problemName} [${labelForProblemPriority(problem.priority)} | ${labelForProblemDiagnosisStatus(problem.diagnosisStatus)}]`,
      );
      lines.push(`   Current Summary: ${problem.currentSummary.join(" | ")}`);
      lines.push(`   Latest Update: ${problem.latestUpdate.join(" | ")}`);
      lines.push(`   Evidence: ${problem.evidence.join(" | ")}`);
      lines.push(`   Treatment: ${problem.treatment.join(" | ")}`);
      lines.push(`   Reasoning: ${problem.reasoning.join(" | ")}`);
      lines.push(`   Today's Plan: ${problem.todayPlan.join(" | ")}`);
      lines.push(`   History: ${problem.history.join(" || ")}`);
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
    .filter((problem) => problem.priority !== "RESOLVED_CHRONIC" && !problem.resolvedAt)
    .map(buildProblemEntry);
  const resolvedProblems = problems
    .filter((problem) => problem.priority === "RESOLVED_CHRONIC" || Boolean(problem.resolvedAt))
    .map(
      (problem) =>
        `${problem.problemName}${problem.currentStatusSummary ? ` | ${problem.currentStatusSummary}` : ""}`,
    );
  const consultTasks = tasks.filter((task) => task.type === "consult");
  const incompleteTasks = tasks.filter((task) => task.status !== "done");
  const orderedTasks = buildOrderedTaskLines(tasks, problems);
  const pendingIssues = [
    ...problems.flatMap((problem) =>
      problem.linkedTasks.filter((task) => task.status !== "done").map((task) => task.title),
    ),
    ...(handover?.note ? [handover.note] : []),
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
      .map((problem) => `Deterioration warning: ${problem.problemName}`),
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
    hospitalCourse: makeSection(
      "Hospital Course",
      problems.map((problem) =>
        [
          problem.problemName,
          problem.currentStatusSummary,
          problem.latestEntry?.statusUpdate,
          problem.latestEntry?.todayPlan ? `Plan: ${problem.latestEntry.todayPlan}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
      ),
    ),
    activeProblems,
    resolvedProblems,
    consultations: consultTasks.length
      ? consultTasks.map((task) => task.title)
      : ["No active consultation task recorded"],
    pendingIssues,
    suggestedPlan,
    safetyAlerts,
    tasks: orderedTasks.length ? orderedTasks : incompleteTasks.map(formatTaskLine),
  };

  return {
    ...payloadWithoutText,
    plainText: buildPlainText(payloadWithoutText),
  };
}
