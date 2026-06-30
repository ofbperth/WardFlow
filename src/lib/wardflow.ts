import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import { z } from "zod";
import { measureServerTiming } from "@/lib/dev-timing";
import { hasLiveSupabase } from "@/lib/env";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import {
  compareProblemPriority,
  labelForTaskPriority,
  labelForTaskStatus,
} from "@/lib/utils";
import {
  demoActivitySeed,
  demoDischargeSummarySeed,
  demoHandoverSeed,
  demoPatientsSeed,
  demoProblemsSeed,
  demoProfiles,
  demoTaskUpdatesSeed,
  demoTasksSeed,
  demoTemplatesSeed,
  demoWards,
} from "@/lib/demo-data";
import type {
  ActivityLog,
  BulkTaskPayload,
  DischargeSummary,
  DischargedDirectoryItem,
  HandoverBundle,
  HandoverNote,
  PendingTaskHandoverFilters,
  Patient,
  PatientBundle,
  Problem,
  ProblemPriority,
  Role,
  SessionContext,
  SummaryNoteExportResult,
  SummaryNotePayload,
  Student,
  StudentWardAssignment,
  StudentWardAssignmentBoardData,
  StudentWardAssignmentEntry,
  StudentWardAssignmentWard,
  TaskTemplate,
  TaskUpdate,
  TaskWithUpdates,
  TaskWorkspaceFilters,
  TaskWorkspaceGroup,
  UserProfile,
  Ward,
  WardPatientSummary,
  WardSummary,
  WardTask,
} from "@/lib/types";
import { exportSummaryNoteToGoogleDocs } from "@/lib/google-docs";
import { buildSummaryNotePayload } from "@/lib/summary-note";

type DemoStore = {
  wards: Ward[];
  patients: Patient[];
  problems: Problem[];
  tasks: WardTask[];
  taskUpdates: TaskUpdate[];
  handovers: HandoverNote[];
  dischargeSummaries: DischargeSummary[];
  activity: ActivityLog[];
  templates: TaskTemplate[];
  profiles: UserProfile[];
  studentWardAssignments: StudentWardAssignment[];
};

type WardOverviewData = {
  summaries: WardSummary[];
  profiles: UserProfile[];
};

type WardRow = {
  id: string;
  name: string;
  location?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProfileRow = {
  id: string;
  name: string | null;
  email?: string | null;
  avatar_url: string | null;
  role: Role | null;
  ward_assignment: string | null;
  student_code?: string | null;
  academic_year?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type StudentWardAssignmentRow = {
  id: string;
  student_id: string;
  ward_id: string;
  assigned_by_user_id: string | null;
  assigned_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type PatientRow = {
  id: string;
  ward_id: string | null;
  bed: string;
  display_name: string;
  age: number | null;
  sex: string | null;
  underlying_disease?: string | null;
  diagnosis: string;
  status: Patient["status"];
  responsible_doctor_id: string | null;
  allergy: string | null;
  precaution: Patient["precaution"];
  code_status: string | null;
  lifecycle: Patient["lifecycle"];
  discharged_at: string | null;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
};

type ProblemRow = {
  id: string;
  patient_id: string;
  title: string;
  status: Problem["status"];
  priority?: ProblemPriority | null;
  current_status?: string | null;
  evidence?: string | null;
  treatment?: string | null;
  reasoning?: string | null;
  today_plan?: string | null;
  key_data: string | null;
  plan: string | null;
  pending: string | null;
  watch_out: string | null;
  include_in_handover: boolean;
  sort_order: number;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  id: string;
  patient_id: string;
  problem_id?: string | null;
  title: string;
  note: string | null;
  owner_id: string | null;
  status: WardTask["status"];
  priority: WardTask["priority"];
  type: WardTask["type"];
  due_at: string | null;
  blocked_reason: string | null;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
};

type TaskUpdateRow = {
  id: string;
  task_id: string;
  note: string;
  created_by_id: string | null;
  created_by_name: string;
  created_at: string;
};

type HandoverRow = {
  id: string;
  patient_id: string;
  note: string;
  escalation_instruction: string | null;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
};

type ActivityRow = {
  id: string;
  patient_id: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json: ActivityLog["beforeJson"];
  after_json: ActivityLog["afterJson"];
  created_at: string;
};

type TemplateRow = {
  id: string;
  title: string;
  type: TaskTemplate["type"];
  default_priority: TaskTemplate["defaultPriority"];
};

type DischargeSummaryRow = {
  id: string;
  patient_id: string;
  ward_id: string | null;
  created_by_id: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  admit_date: string;
  discharge_date: string;
  length_of_stay: string;
  primary_diagnosis: string;
  hospital_course: string;
  plan: string;
  home_medication: string;
};

type ActivityInsert = {
  patient_id: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json: ActivityLog["beforeJson"];
  after_json: ActivityLog["afterJson"];
};

type LiveClient = NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>;

const DEMO_STORE_PATH = path.join(process.cwd(), ".wardflow-demo", "store.json");

function buildSessionCacheSeed(
  mode: SessionContext["mode"],
  profileId: string,
  role: Role,
  wardAssignment: string | null,
): SessionContext {
  return {
    mode,
    profile: {
      id: profileId,
      name: "Cached Session",
      email: "",
      avatarUrl: null,
      role,
      wardAssignment,
    },
  };
}

const patientSchema = z.object({
  id: z.string().optional(),
  wardId: z.string().min(1),
  bed: z.string().min(1),
  displayName: z.string().min(1),
  ageText: z.string().optional().nullable(),
  sex: z.enum(["Male", "Female"]).optional().nullable(),
  underlyingDisease: z.string().optional().nullable(),
  diagnosis: z.string().min(1),
  status: z.enum(["stable", "watch", "critical"]),
  responsibleDoctorId: z.string().optional().nullable(),
  precaution: z.enum(["none", "contact", "droplet", "airborne"]),
  updatedAt: z.string().optional().nullable(),
});

const problemSchema = z.object({
  id: z.string().optional(),
  patientId: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["active", "improving", "worsening", "resolved"]),
  priority: z.enum(["ACTIVE_UNSTABLE", "ACTIVE_STABLE", "MONITORING", "RESOLVED_CHRONIC"]),
  currentStatus: z.string().optional().nullable(),
  evidence: z.string().optional().nullable(),
  treatment: z.string().optional().nullable(),
  reasoning: z.string().optional().nullable(),
  todayPlan: z.string().optional().nullable(),
  keyData: z.string().optional().nullable(),
  plan: z.string().optional().nullable(),
  pending: z.string().optional().nullable(),
  watchOut: z.string().optional().nullable(),
  includeInHandover: z.coerce.boolean(),
  updatedAt: z.string().optional().nullable(),
});

const taskSchema = z.object({
  id: z.string().optional(),
  patientId: z.string().min(1),
  problemId: z.string().optional().nullable(),
  title: z.string().min(1),
  ownerId: z.string().optional().nullable(),
  status: z.enum(["not_started", "in_progress", "done", "blocked"]),
  priority: z.enum(["normal", "urgent", "emergency"]),
  type: z.enum([
    "lab",
    "imaging",
    "consult",
    "procedure",
    "family_talk",
    "discharge",
    "medication",
    "other",
  ]),
  note: z.string().optional().nullable(),
  dueAt: z.string().optional().nullable(),
  blockedReason: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
});

const taskUpdateSchema = z.object({
  taskId: z.string().min(1),
  note: z.string().trim().min(1),
});

const bulkTaskRowSchema = z.object({
  patientId: z.string().trim().default(""),
  title: z.string().trim().default(""),
  ownerId: z.string().trim().nullable().optional(),
  priority: z.enum(["normal", "urgent", "emergency"]).default("normal"),
  type: z.enum([
    "lab",
    "imaging",
    "consult",
    "procedure",
    "family_talk",
    "discharge",
    "medication",
    "other",
  ]).default("other"),
  note: z.string().trim().nullable().optional(),
});

const bulkTaskPayloadSchema = z.object({
  rows: z.array(bulkTaskRowSchema),
});

const handoverSchema = z.object({
  patientId: z.string().min(1),
  note: z.string().optional().default(""),
  escalationInstruction: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
});

const wardSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
});

const deleteWardSchema = z.object({
  wardId: z.string().min(1),
});

const deletePatientSchema = z.object({
  patientId: z.string().min(1),
});

const templateSchema = z.object({
  title: z.string().min(1),
  type: z.enum([
    "lab",
    "imaging",
    "consult",
    "procedure",
    "family_talk",
    "discharge",
    "medication",
    "other",
  ]),
  defaultPriority: z.enum(["normal", "urgent", "emergency"]),
});

const userRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["admin", "resident", "student"]),
  wardAssignment: z.string().optional().nullable(),
});

const saveStudentWardAssignmentsSchema = z.object({
  wardId: z.string().min(1),
  studentIds: z.array(z.string().uuid()).default([]),
  forceMove: z.boolean().default(false),
});

const removeStudentWardAssignmentSchema = z.object({
  assignmentId: z.string().min(1),
});

const deleteUserSchema = z.object({
  userId: z.string().min(1),
});

const dischargeSummarySchema = z.object({
  patientId: z.string().min(1),
  patientUpdatedAt: z.string().optional().nullable(),
  primaryDiagnosis: z.string().min(1),
  hospitalCourse: z.string().default(""),
  plan: z.string().default(""),
  homeMedication: z.string().default(""),
});

function now() {
  return new Date().toISOString();
}

function nextId(prefix: string) {
  if (hasLiveSupabase()) {
    return crypto.randomUUID();
  }

  return `${prefix}-${crypto.randomUUID()}`;
}

function textOrNull(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseAgeInput(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error("Age must be a number");
  }
  return parsed;
}

function buildStudentAssignmentsFromProfiles(profiles: UserProfile[]): StudentWardAssignment[] {
  return profiles
    .filter((profile) => profile.role === "student" && profile.wardAssignment)
    .map((profile) => {
      const timestamp = profile.updatedAt ?? profile.createdAt ?? now();
      return {
        id: `student-assignment-seed-${profile.id}`,
        studentId: profile.id,
        wardId: profile.wardAssignment ?? "",
        assignedByUserId: null,
        assignedAt: timestamp,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
}

function createSeedStore(): DemoStore {
  const profiles = structuredClone(demoProfiles);
  return {
    wards: structuredClone(demoWards),
    patients: structuredClone(demoPatientsSeed),
    problems: structuredClone(demoProblemsSeed),
    tasks: structuredClone(demoTasksSeed),
    taskUpdates: structuredClone(demoTaskUpdatesSeed),
    handovers: structuredClone(demoHandoverSeed),
    dischargeSummaries: structuredClone(demoDischargeSummarySeed),
    activity: structuredClone(demoActivitySeed),
    templates: structuredClone(demoTemplatesSeed),
    profiles,
    studentWardAssignments: buildStudentAssignmentsFromProfiles(profiles),
  };
}

let store: DemoStore = createSeedStore();

function normalizeProblemRecord(problem: Partial<Problem>): Problem {
  return {
    id: problem.id ?? nextId("problem"),
    patientId: problem.patientId ?? "",
    title: problem.title ?? "Untitled problem",
    status: problem.status ?? "active",
    priority: problem.priority ?? defaultProblemPriority(problem.status ?? "active"),
    currentStatus: problem.currentStatus ?? problem.keyData ?? null,
    evidence: problem.evidence ?? problem.keyData ?? null,
    treatment: problem.treatment ?? null,
    reasoning: problem.reasoning ?? null,
    todayPlan: problem.todayPlan ?? problem.plan ?? null,
    keyData: problem.keyData ?? null,
    plan: problem.plan ?? null,
    pending: problem.pending ?? null,
    watchOut: problem.watchOut ?? null,
    includeInHandover: problem.includeInHandover ?? true,
    sortOrder: problem.sortOrder ?? 0,
    updatedAt: problem.updatedAt ?? now(),
  };
}

function normalizeTaskRecord(task: Partial<WardTask>): WardTask {
  return {
    id: task.id ?? nextId("task"),
    patientId: task.patientId ?? "",
    problemId: task.problemId ?? null,
    title: task.title ?? "Untitled task",
    note: task.note ?? null,
    ownerId: task.ownerId ?? null,
    ownerName: task.ownerName ?? null,
    status: task.status ?? "not_started",
    priority: task.priority ?? "normal",
    type: task.type ?? "other",
    dueAt: task.dueAt ?? null,
    blockedReason: task.blockedReason ?? null,
    updatedById: task.updatedById ?? null,
    updatedByName: task.updatedByName ?? null,
    updatedAt: task.updatedAt ?? now(),
  };
}

function normalizePatientRecord(patient: Partial<Patient>): Patient {
  return {
    id: patient.id ?? nextId("patient"),
    wardId: patient.wardId ?? "",
    bed: patient.bed ?? "",
    displayName: patient.displayName ?? "Unknown patient",
    age: patient.age ?? null,
    sex: patient.sex ?? null,
    underlyingDisease: patient.underlyingDisease ?? null,
    diagnosis: patient.diagnosis ?? "",
    status: patient.status ?? "stable",
    responsibleDoctorId: patient.responsibleDoctorId ?? null,
    responsibleDoctorName: patient.responsibleDoctorName ?? null,
    allergy: patient.allergy ?? null,
    precaution: patient.precaution ?? "none",
    codeStatus: patient.codeStatus ?? null,
    lifecycle: patient.lifecycle ?? "active",
    dischargedAt: patient.dischargedAt ?? null,
    lastUpdate: patient.lastUpdate ?? now(),
  };
}

function normalizeStore(input: Partial<DemoStore> | null | undefined): DemoStore {
  const seed = createSeedStore();

  return {
    wards: input?.wards ?? seed.wards,
    patients: (input?.patients ?? seed.patients).map(normalizePatientRecord),
    problems: (input?.problems ?? seed.problems).map(normalizeProblemRecord),
    tasks: (input?.tasks ?? seed.tasks).map(normalizeTaskRecord),
    taskUpdates: input?.taskUpdates ?? seed.taskUpdates,
    handovers: input?.handovers ?? seed.handovers,
    dischargeSummaries: input?.dischargeSummaries ?? seed.dischargeSummaries,
    activity: input?.activity ?? seed.activity,
    templates: input?.templates ?? seed.templates,
    profiles: input?.profiles ?? seed.profiles,
    studentWardAssignments:
      input?.studentWardAssignments ?? buildStudentAssignmentsFromProfiles(input?.profiles ?? seed.profiles),
  };
}

async function ensureDemoStoreLoaded() {
  const directory = path.dirname(DEMO_STORE_PATH);
  fs.mkdirSync(directory, { recursive: true });

  if (!fs.existsSync(DEMO_STORE_PATH)) {
    store = createSeedStore();
    fs.writeFileSync(DEMO_STORE_PATH, JSON.stringify(store, null, 2));
    return;
  }

  store = normalizeStore(JSON.parse(fs.readFileSync(DEMO_STORE_PATH, "utf8")) as DemoStore);
}

async function persistDemoStore() {
  const directory = path.dirname(DEMO_STORE_PATH);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(DEMO_STORE_PATH, JSON.stringify(store, null, 2));
}

function canManageAdmin(session: SessionContext) {
  return session.profile.role === "admin";
}

function canManagePatients(session: SessionContext) {
  return session.profile.role === "admin" || session.profile.role === "resident";
}

function canManageClinicalEntries(session: SessionContext) {
  return (
    session.profile.role === "admin" ||
    session.profile.role === "resident" ||
    session.profile.role === "student"
  );
}

function canManageTaskWorkflowEveryWard(session: SessionContext) {
  return session.profile.role === "admin" || session.profile.role === "resident";
}

function canViewAllWards(session: SessionContext) {
  return session.profile.role === "admin" || session.profile.role === "resident";
}

function isStudentAwaitingWardAssignment(session: SessionContext) {
  return session.profile.role === "student" && !session.profile.wardAssignment;
}

function isProfileVisibleToSession(profile: UserProfile, session: SessionContext) {
  if (isStudentAwaitingWardAssignment(session)) {
    return profile.id === session.profile.id;
  }

  return (
    canViewAllWards(session) ||
    profile.role === "admin" ||
    profile.role === "resident" ||
    profile.wardAssignment === session.profile.wardAssignment ||
    profile.id === session.profile.id
  );
}

function requireWardReadAccess(session: SessionContext, wardId: string | null) {
  if (!wardId) {
    if (!canManageAdmin(session)) {
      throw new Error("Missing ward assignment");
    }
    return;
  }

  if (canViewAllWards(session)) return;
  if (session.profile.wardAssignment !== wardId) {
    throw new Error("Ward access denied");
  }
}

function requireWardWriteAccess(session: SessionContext, wardId: string | null) {
  if (!wardId) {
    throw new Error("Missing ward assignment");
  }

  if (canManagePatients(session)) return;
  if (session.profile.wardAssignment !== wardId) {
    throw new Error("Ward access denied");
  }
}

function requireTaskWorkflowWriteAccess(session: SessionContext, wardId: string | null) {
  if (!wardId) {
    throw new Error("Missing ward assignment");
  }

  if (canManageTaskWorkflowEveryWard(session)) {
    return;
  }

  if (session.profile.role === "student" && session.profile.wardAssignment === wardId) {
    return;
  }

  throw new Error("Ward access denied");
}

function requirePatientManager(session: SessionContext) {
  if (!canManagePatients(session)) {
    throw new Error("Only admin or resident can manage patient core data");
  }
}

function requireClinicalEditor(session: SessionContext) {
  if (!canManageClinicalEntries(session)) {
    throw new Error("Clinical entries are not allowed");
  }
}

function patientById(input: DemoStore, patientId: string) {
  return input.patients.find((patient) => patient.id === patientId) ?? null;
}

function visibleWardIds(input: DemoStore, session: SessionContext) {
  if (isStudentAwaitingWardAssignment(session)) {
    return [];
  }

  return canViewAllWards(session)
    ? input.wards.map((ward) => ward.id)
    : [session.profile.wardAssignment].filter(Boolean) as string[];
}

function compareBed(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function defaultProblemPriority(status: Problem["status"]): ProblemPriority {
  switch (status) {
    case "worsening":
      return "ACTIVE_UNSTABLE";
    case "active":
      return "ACTIVE_STABLE";
    case "improving":
      return "MONITORING";
    case "resolved":
    default:
      return "RESOLVED_CHRONIC";
  }
}

function summaryLine(...values: Array<string | null | undefined>) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" | ");
}

function compareTaskPriority(left: WardTask["priority"], right: WardTask["priority"]) {
  const weight = (priority: WardTask["priority"]) =>
    priority === "emergency" ? 0 : priority === "urgent" ? 1 : 2;
  return weight(left) - weight(right);
}

function getPatientDirectoryName(
  input: DemoStore,
  profileId: string | null,
  fallback: string | null = null,
) {
  return input.profiles.find((profile) => profile.id === profileId)?.name ?? fallback ?? null;
}

function addActivityToDemoStore(
  session: SessionContext,
  patientId: string,
  action: string,
  entityType: string,
  entityId: string,
  beforeJson: ActivityLog["beforeJson"],
  afterJson: ActivityLog["afterJson"],
) {
  store.activity.unshift({
    id: nextId("activity"),
    patientId,
    actorId: session.profile.id,
    actorName: session.profile.name,
    action,
    entityType,
    entityId,
    beforeJson,
    afterJson,
    createdAt: now(),
  });
}

function refreshDemoPatient(patientId: string) {
  const patient = patientById(store, patientId);
  if (patient) {
    patient.lastUpdate = now();
  }
}

function summarizeWardPatient(
  patient: Patient,
  tasks: WardTask[],
  problems: Problem[],
  referenceTime = now(),
): WardPatientSummary {
  const activeProblems = problems
    .filter((problem) => problem.priority !== "RESOLVED_CHRONIC")
    .sort((left, right) => {
      const priorityDiff = compareProblemPriority(left.priority, right.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return left.sortOrder - right.sortOrder;
    });

  const highestPriorityProblem = activeProblems[0]
    ? {
        id: activeProblems[0].id,
        title: activeProblems[0].title,
        priority: activeProblems[0].priority,
        currentStatus: activeProblems[0].currentStatus ?? activeProblems[0].keyData,
      }
    : null;

  const pendingTasks = tasks.filter((task) => task.status !== "done");

  return {
    ...patient,
    pendingTaskCount: pendingTasks.length,
    blockedTaskCount: pendingTasks.filter((task) => task.status === "blocked").length,
    overdueTaskCount: pendingTasks.filter(
      (task) => task.dueAt && new Date(task.dueAt).getTime() < new Date(referenceTime).getTime(),
    ).length,
    urgentTaskCount: pendingTasks.filter((task) => task.priority !== "normal").length,
    highestPriorityProblem,
  };
}

function buildWardSummary(
  input: DemoStore,
  session: SessionContext,
  lifecycle: "active" | "discharged",
): WardSummary[] {
  const wardIds = visibleWardIds(input, session);

  return input.wards
    .filter((ward) => wardIds.includes(ward.id))
    .map((ward) => ({
      ward,
      patients: input.patients
        .filter((patient) => patient.wardId === ward.id && patient.lifecycle === lifecycle)
        .map((patient) =>
          summarizeWardPatient(
            patient,
            input.tasks.filter((task) => task.patientId === patient.id),
            input.problems.filter((problem) => problem.patientId === patient.id),
          ),
        )
        .sort((left, right) => compareBed(left.bed, right.bed)),
    }))
    .filter((summary) => summary.patients.length > 0 || lifecycle === "active");
}

function summaryByPatientId(input: DemoStore, patientId: string) {
  return input.dischargeSummaries.find((summary) => summary.patientId === patientId) ?? null;
}

function getPatientAdmitDate(input: DemoStore, patientId: string) {
  const patientActivities = input.activity
    .filter((activity) => activity.patientId === patientId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return (
    patientActivities.find((activity) => activity.action === "patient.created")?.createdAt ??
    patientActivities[0]?.createdAt ??
    null
  );
}

function getLengthOfStay(admitDate: string | null, dischargeDate: string) {
  if (!admitDate) return "";
  const diffMs = new Date(dischargeDate).getTime() - new Date(admitDate).getTime();
  if (Number.isNaN(diffMs)) return "";
  const dayCount = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  return `${dayCount} day${dayCount > 1 ? "s" : ""}`;
}

function toNumberedLines(items: string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function buildDischargeDraft(input: DemoStore, patientId: string) {
  const patient = patientById(input, patientId);
  if (!patient) return null;

  const hospitalCourseItems = input.problems
    .filter((problem) => problem.patientId === patientId)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((problem) =>
      [
        problem.title,
        problem.keyData,
        problem.plan ? `Plan: ${problem.plan}` : null,
        problem.pending ? `Pending: ${problem.pending}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
    );

  const planItems = input.tasks
    .filter((task) => task.patientId === patientId && task.status !== "done")
    .map((task) =>
      [task.title, task.note, task.blockedReason ? `Blocked: ${task.blockedReason}` : null]
        .filter(Boolean)
        .join(" | "),
    );

  const admitDate = getPatientAdmitDate(input, patientId);
  const dischargeDate = now();

  return {
    admitDate,
    dischargeDate,
    lengthOfStay: getLengthOfStay(admitDate, dischargeDate),
    primaryDiagnosis: patient.diagnosis,
    hospitalCourse: hospitalCourseItems.length ? toNumberedLines(hospitalCourseItems) : "",
    plan: planItems.length ? toNumberedLines(planItems) : "",
    homeMedication: "",
  };
}

function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    name: row.name ?? "Unknown User",
    email: row.email ?? "",
    avatarUrl: row.avatar_url ?? null,
    role: row.role ?? "student",
    wardAssignment: row.ward_assignment ?? null,
    studentCode: row.student_code ?? null,
    academicYear: row.academic_year ?? null,
    isActive: row.is_active ?? true,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapWardRow(row: WardRow): Ward {
  return {
    id: row.id,
    name: row.name,
    location: row.location ?? null,
    isActive: row.is_active ?? true,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapStudentWardAssignmentRow(row: StudentWardAssignmentRow): StudentWardAssignment {
  return {
    id: row.id,
    studentId: row.student_id,
    wardId: row.ward_id,
    assignedByUserId: row.assigned_by_user_id,
    assignedAt: row.assigned_at,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPatientRow(row: PatientRow, profiles: Map<string, UserProfile>): Patient {
  return {
    id: row.id,
    wardId: row.ward_id ?? "",
    bed: row.bed,
    displayName: row.display_name,
    age: row.age,
    sex: row.sex,
    underlyingDisease: row.underlying_disease ?? null,
    diagnosis: row.diagnosis,
    status: row.status,
    responsibleDoctorId: row.responsible_doctor_id,
    responsibleDoctorName: row.responsible_doctor_id
      ? profiles.get(row.responsible_doctor_id)?.name ?? null
      : null,
    allergy: row.allergy,
    precaution: row.precaution,
    codeStatus: row.code_status,
    lifecycle: row.lifecycle,
    dischargedAt: row.discharged_at,
    lastUpdate: row.updated_at,
  };
}

function mapProblemRow(row: ProblemRow): Problem {
  const priority = row.priority ?? defaultProblemPriority(row.status);
  const currentStatus = row.current_status ?? row.key_data;
  const evidence = row.evidence ?? row.key_data;
  const todayPlan = row.today_plan ?? row.plan;
  return {
    id: row.id,
    patientId: row.patient_id,
    title: row.title,
    status: row.status,
    priority,
    currentStatus,
    evidence,
    treatment: row.treatment ?? null,
    reasoning: row.reasoning ?? null,
    todayPlan,
    keyData: row.key_data,
    plan: row.plan,
    pending: row.pending,
    watchOut: row.watch_out,
    includeInHandover: row.include_in_handover,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

function mapTaskRow(row: TaskRow, profiles: Map<string, UserProfile>): WardTask {
  return {
    id: row.id,
    patientId: row.patient_id,
    problemId: row.problem_id ?? null,
    title: row.title,
    note: row.note,
    ownerId: row.owner_id,
    ownerName: row.owner_id ? profiles.get(row.owner_id)?.name ?? null : null,
    status: row.status,
    priority: row.priority,
    type: row.type,
    dueAt: row.due_at,
    blockedReason: row.blocked_reason,
    updatedById: row.updated_by_id,
    updatedByName: row.updated_by_id ? profiles.get(row.updated_by_id)?.name ?? null : null,
    updatedAt: row.updated_at,
  };
}

function mapTaskUpdateRow(row: TaskUpdateRow): TaskUpdate {
  return {
    id: row.id,
    taskId: row.task_id,
    note: row.note,
    createdById: row.created_by_id,
    createdByName: row.created_by_name || "Unknown User",
    createdAt: row.created_at,
  };
}

function mapHandoverRow(row: HandoverRow): HandoverNote {
  return {
    id: row.id,
    patientId: row.patient_id,
    note: row.note,
    escalationInstruction: row.escalation_instruction,
    updatedAt: row.updated_at,
  };
}

function mapActivityRow(row: ActivityRow): ActivityLog {
  return {
    id: row.id,
    patientId: row.patient_id,
    actorId: row.actor_id,
    actorName: row.actor_name || "Unknown User",
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    beforeJson: row.before_json,
    afterJson: row.after_json,
    createdAt: row.created_at,
  };
}

function mapTemplateRow(row: TemplateRow): TaskTemplate {
  return {
    id: row.id,
    title: row.title === "Consult specialist" ? "Consult" : row.title,
    type: row.type,
    defaultPriority: row.default_priority,
  };
}

function mapDischargeSummaryRow(row: DischargeSummaryRow): DischargeSummary {
  return {
    id: row.id,
    patientId: row.patient_id,
    wardId: row.ward_id ?? "",
    createdById: row.created_by_id,
    createdByName: row.created_by_name || "Unknown User",
    createdAt: row.created_at,
    admitDate: row.admit_date,
    dischargeDate: row.discharge_date,
    lengthOfStay: row.length_of_stay,
    primaryDiagnosis: row.primary_diagnosis,
    hospitalCourse: row.hospital_course,
    plan: row.plan,
    homeMedication: row.home_medication,
  };
}

function getTaskUpdatesForTask(
  input: DemoStore,
  taskId: string,
  limit = Number.POSITIVE_INFINITY,
): TaskUpdate[] {
  const updates = input.taskUpdates
    .filter((update) => update.taskId === taskId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return Number.isFinite(limit) ? updates.slice(0, limit) : updates;
}

function attachTaskUpdates(input: DemoStore, tasks: WardTask[]): TaskWithUpdates[] {
  return tasks.map((task) => ({
    ...task,
    updates: getTaskUpdatesForTask(input, task.id),
  }));
}

async function getLiveClient() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  return supabase as LiveClient;
}

function ensureNoError<T extends { error: { message: string } | null }>(result: T, message: string) {
  if (result.error) {
    throw new Error(`${message}: ${result.error.message}`);
  }
}

function isRecoverableTaskUpdatesReadError(error: { message: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("task_updates") &&
    (message.includes("does not exist") ||
      message.includes("could not find the table") ||
      message.includes("column") ||
      message.includes("schema cache") ||
      message.includes("permission denied"))
  );
}

function isRecoverableStudentAssignmentReadError(error: { message: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("student_ward_assignments") &&
    (message.includes("does not exist") ||
      message.includes("could not find the table") ||
      message.includes("schema cache") ||
      message.includes("permission denied"))
  );
}

function isRecoverableProblemSchemaError(error: { message: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("problem") &&
    (message.includes("priority") ||
      message.includes("current_status") ||
      message.includes("evidence") ||
      message.includes("treatment") ||
      message.includes("reasoning") ||
      message.includes("today_plan") ||
      message.includes("schema cache") ||
      message.includes("column"))
  );
}

function isRecoverableTaskProblemLinkError(error: { message: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("ward_tasks") &&
    message.includes("problem_id") &&
    (message.includes("schema cache") || message.includes("column") || message.includes("does not exist"))
  );
}

function isRecoverablePatientUnderlyingSchemaError(error: { message: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("patients") &&
    message.includes("underlying_disease") &&
    (message.includes("schema cache") || message.includes("column") || message.includes("does not exist"))
  );
}

async function loadLiveStore(session: SessionContext): Promise<DemoStore> {
  return measureServerTiming("loadLiveStore", async () => {
    const supabase = await getLiveClient();
    const profileColumns =
      session.profile.role === "admin"
        ? "id, name, email, avatar_url, role, ward_assignment, student_code, academic_year, is_active, created_at, updated_at"
        : "id, name, avatar_url, role, ward_assignment, student_code, academic_year, is_active, created_at, updated_at";

    const [
      wardsResult,
      profilesResult,
      patientsResult,
      problemsResult,
      tasksResult,
      handoversResult,
      activityResult,
      templatesResult,
      summariesResult,
      studentAssignmentsResult,
    ] = await Promise.all([
      supabase
        .from("wards")
        .select("id, name, location, is_active, created_at, updated_at")
        .order("name", { ascending: true }),
      supabase.from("profiles").select(profileColumns).order("name", { ascending: true }),
      supabase
        .from("patients")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("problems")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase
        .from("ward_tasks")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("handover_notes")
        .select("id, patient_id, note, escalation_instruction, updated_by_id, created_at, updated_at"),
      supabase
        .from("activity_logs")
        .select(
          "id, patient_id, actor_id, actor_name, action, entity_type, entity_id, before_json, after_json, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("task_templates")
        .select("id, title, type, default_priority")
        .order("title", { ascending: true }),
      supabase
        .from("discharge_summaries")
        .select(
          "id, patient_id, ward_id, created_by_id, created_by_name, created_at, updated_at, admit_date, discharge_date, length_of_stay, primary_diagnosis, hospital_course, plan, home_medication",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("student_ward_assignments")
        .select(
          "id, student_id, ward_id, assigned_by_user_id, assigned_at, is_active, created_at, updated_at",
        )
        .order("assigned_at", { ascending: true }),
    ]);

    ensureNoError(wardsResult, "Failed to load wards");
    ensureNoError(profilesResult, "Failed to load profiles");
    ensureNoError(patientsResult, "Failed to load patients");
    ensureNoError(problemsResult, "Failed to load problems");
    ensureNoError(tasksResult, "Failed to load tasks");
    ensureNoError(handoversResult, "Failed to load handover notes");
    ensureNoError(activityResult, "Failed to load activity logs");
    ensureNoError(templatesResult, "Failed to load task templates");
    ensureNoError(summariesResult, "Failed to load discharge summaries");
    if (
      studentAssignmentsResult.error &&
      !isRecoverableStudentAssignmentReadError(studentAssignmentsResult.error)
    ) {
      ensureNoError(studentAssignmentsResult, "Failed to load student ward assignments");
    }

    const taskUpdatesResult = await supabase
      .from("task_updates")
      .select("id, task_id, note, created_by_id, created_by_name, created_at")
      .order("created_at", { ascending: false });
    if (taskUpdatesResult.error && !isRecoverableTaskUpdatesReadError(taskUpdatesResult.error)) {
      ensureNoError(taskUpdatesResult, "Failed to load task updates");
    }

    const profiles = ((profilesResult.data ?? []) as unknown as ProfileRow[]).map(mapProfileRow);
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

    return {
      wards: ((wardsResult.data ?? []) as WardRow[]).map(mapWardRow),
      profiles,
      patients: ((patientsResult.data ?? []) as PatientRow[]).map((row) =>
        mapPatientRow(row, profileMap),
      ),
      problems: ((problemsResult.data ?? []) as ProblemRow[]).map(mapProblemRow),
      tasks: ((tasksResult.data ?? []) as TaskRow[]).map((row) => mapTaskRow(row, profileMap)),
      taskUpdates: (((taskUpdatesResult.error ? [] : taskUpdatesResult.data) ?? []) as TaskUpdateRow[]).map(
        mapTaskUpdateRow,
      ),
      handovers: ((handoversResult.data ?? []) as HandoverRow[]).map(mapHandoverRow),
      activity: ((activityResult.data ?? []) as ActivityRow[]).map(mapActivityRow),
      templates: ((templatesResult.data ?? []) as TemplateRow[]).map(mapTemplateRow),
      dischargeSummaries: ((summariesResult.data ?? []) as DischargeSummaryRow[]).map(
        mapDischargeSummaryRow,
      ),
      studentWardAssignments: (((studentAssignmentsResult.error
        ? []
        : studentAssignmentsResult.data) ?? []) as StudentWardAssignmentRow[]).map(
        mapStudentWardAssignmentRow,
      ),
    };
  });
}

const getStoreForSessionCached = cache(
  async (
    mode: SessionContext["mode"],
    profileId: string,
    role: Role,
    wardAssignment: string | null,
  ) => {
    if (mode === "demo" || !hasLiveSupabase()) {
      await ensureDemoStoreLoaded();
      return store;
    }

    return loadLiveStore(buildSessionCacheSeed(mode, profileId, role, wardAssignment));
  },
);

async function getStoreForSession(session: SessionContext) {
  return getStoreForSessionCached(
    session.mode,
    session.profile.id,
    session.profile.role,
    session.profile.wardAssignment,
  );
}

function buildWardOverviewSummaries(
  wards: Ward[],
  patients: PatientRow[],
  problemsByPatientId: Map<string, Problem[]>,
  taskCounts: Map<string, { pending: number; blocked: number; overdue: number; urgent: number }>,
  profiles: Map<string, UserProfile>,
) {
  return wards
    .map((ward) => ({
      ward,
      patients: patients
        .filter((patient) => patient.ward_id === ward.id)
        .map((patient) => {
          const counts = taskCounts.get(patient.id) ?? {
            pending: 0,
            blocked: 0,
            overdue: 0,
            urgent: 0,
          };
          const mappedPatient = mapPatientRow(patient, profiles);
          const patientProblems = (problemsByPatientId.get(patient.id) ?? [])
            .filter((problem) => problem.priority !== "RESOLVED_CHRONIC")
            .sort((left, right) => {
              const priorityDiff = compareProblemPriority(left.priority, right.priority);
              if (priorityDiff !== 0) return priorityDiff;
              return left.sortOrder - right.sortOrder;
            });
          const highestPriorityProblem = patientProblems[0] ?? null;
          return {
            ...mappedPatient,
            pendingTaskCount: counts.pending,
            blockedTaskCount: counts.blocked,
            overdueTaskCount: counts.overdue,
            urgentTaskCount: counts.urgent,
            highestPriorityProblem: highestPriorityProblem
              ? {
                  id: highestPriorityProblem.id,
                  title: highestPriorityProblem.title,
                  priority: highestPriorityProblem.priority,
                  currentStatus: highestPriorityProblem.currentStatus ?? highestPriorityProblem.keyData,
                }
              : null,
          };
        })
        .sort((left, right) => compareBed(left.bed, right.bed)),
    }))
    .filter((summary) => summary.patients.length > 0 || summary.ward.isActive !== false);
}

const getWardOverviewDataCached = cache(
  async (
    mode: SessionContext["mode"],
    profileId: string,
    role: Role,
    wardAssignment: string | null,
  ): Promise<WardOverviewData> => {
    const session = buildSessionCacheSeed(mode, profileId, role, wardAssignment);

    return measureServerTiming("/wards data load", async () => {
      if (mode === "demo" || !hasLiveSupabase()) {
        const input = await getStoreForSession(session);
        return {
          summaries: buildWardSummary(input, session, "active"),
          profiles: getVisibleProfiles(input, session),
        };
      }

      if (isStudentAwaitingWardAssignment(session)) {
        return {
          summaries: [],
          profiles: [],
        };
      }

      const supabase = await getLiveClient();
      let wardsQuery = supabase
        .from("wards")
        .select("id, name, location, is_active, created_at, updated_at")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (!canViewAllWards(session) && wardAssignment) {
        wardsQuery = wardsQuery.eq("id", wardAssignment);
      }

      const wardsResult = await wardsQuery;
      ensureNoError(wardsResult, "Failed to load wards overview");

      const wards = ((wardsResult.data ?? []) as WardRow[]).map(mapWardRow);
      const wardIds = wards.map((ward) => ward.id);
      if (!wardIds.length) {
        return {
          summaries: [],
          profiles: [],
        };
      }

      const patientsResult = await supabase
        .from("patients")
        .select("*")
        .eq("lifecycle", "active")
        .in("ward_id", wardIds)
        .order("bed", { ascending: true });
      ensureNoError(patientsResult, "Failed to load ward overview patients");

      const patients = (patientsResult.data ?? []) as PatientRow[];
      const patientIds = patients.map((patient) => patient.id);
      const responsibleDoctorIds = [...new Set(
        patients
          .map((patient) => patient.responsible_doctor_id)
          .filter((doctorId): doctorId is string => Boolean(doctorId)),
      )];

      const problemsResult = patientIds.length
        ? await supabase
            .from("problems")
            .select("*")
            .in("patient_id", patientIds)
            .order("sort_order", { ascending: true })
        : { data: [], error: null };
      ensureNoError(problemsResult, "Failed to load ward overview problems");

      const tasksResult = patientIds.length
        ? await supabase
            .from("ward_tasks")
            .select("patient_id, status, priority, due_at")
            .in("patient_id", patientIds)
        : { data: [], error: null };
      ensureNoError(tasksResult, "Failed to load ward overview tasks");

      const profileColumns =
        role === "admin"
          ? "id, name, email, avatar_url, role, ward_assignment, student_code, academic_year, is_active, created_at, updated_at"
          : "id, name, avatar_url, role, ward_assignment, student_code, academic_year, is_active, created_at, updated_at";

      let profilesQuery = supabase.from("profiles").select(profileColumns).order("name", { ascending: true });
      if (!canViewAllWards(session)) {
        const filters = ["role.eq.admin", "role.eq.resident"];
        if (wardAssignment) {
          filters.push(`ward_assignment.eq.${wardAssignment}`);
        }
        if (responsibleDoctorIds.length) {
          filters.push(`id.in.(${responsibleDoctorIds.join(",")})`);
        }
        profilesQuery = profilesQuery.or(filters.join(","));
      }

      const profilesResult = await profilesQuery;
      ensureNoError(profilesResult, "Failed to load ward overview profiles");

      const profiles = ((profilesResult.data ?? []) as unknown as ProfileRow[]).map(mapProfileRow);
      const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
      const taskCounts = new Map<
        string,
        { pending: number; blocked: number; overdue: number; urgent: number }
      >();
      const problemsByPatientId = new Map<string, Problem[]>();

      for (const row of (problemsResult.data ?? []) as ProblemRow[]) {
        const mapped = mapProblemRow(row);
        const existing = problemsByPatientId.get(mapped.patientId) ?? [];
        existing.push(mapped);
        problemsByPatientId.set(mapped.patientId, existing);
      }

      for (const task of ((tasksResult.data ?? []) as Array<
        Pick<TaskRow, "patient_id" | "status" | "priority" | "due_at">
      >)) {
        const current = taskCounts.get(task.patient_id) ?? {
          pending: 0,
          blocked: 0,
          overdue: 0,
          urgent: 0,
        };
        if (task.status !== "done") {
          current.pending += 1;
          if (task.priority !== "normal") {
            current.urgent += 1;
          }
          if (task.due_at && new Date(task.due_at).getTime() < Date.now()) {
            current.overdue += 1;
          }
        }
        if (task.status === "blocked") {
          current.blocked += 1;
        }
        taskCounts.set(task.patient_id, current);
      }

      return {
        summaries: buildWardOverviewSummaries(wards, patients, problemsByPatientId, taskCounts, profileMap),
        profiles: profiles.filter((profile) => isProfileVisibleToSession(profile, session)),
      };
    });
  },
);

function getVisibleProfiles(input: DemoStore, session: SessionContext): UserProfile[] {
  return input.profiles.filter((profile) => isProfileVisibleToSession(profile, session));
}

function getProfilesForWard(input: DemoStore, wardId: string) {
  return input.profiles.filter(
    (profile) =>
      profile.role === "admin" ||
      profile.role === "resident" ||
      profile.wardAssignment === wardId,
  );
}

async function insertActivityLog(supabase: LiveClient, entry: ActivityInsert) {
  const result = await supabase.from("activity_logs").insert({
    id: nextId("activity"),
    ...entry,
  });

  ensureNoError(result, "Failed to write activity log");
}

function assertNoConflict(expected: string | null | undefined, actual: string, entity: string) {
  if (expected && expected !== actual) {
    throw new Error(`Conflict error: ${entity} was updated by another session. Refresh and retry.`);
  }
}

async function fetchLivePatient(supabase: LiveClient, patientId: string) {
  const result = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .maybeSingle();

  ensureNoError(result, "Failed to load patient");
  return (result.data as PatientRow | null) ?? null;
}

async function fetchLiveProblem(supabase: LiveClient, problemId: string) {
  const result = await supabase
    .from("problems")
    .select("*")
    .eq("id", problemId)
    .maybeSingle();

  ensureNoError(result, "Failed to load problem");
  return (result.data as ProblemRow | null) ?? null;
}

async function fetchLiveTask(supabase: LiveClient, taskId: string) {
  const result = await supabase
    .from("ward_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  ensureNoError(result, "Failed to load task");
  return (result.data as TaskRow | null) ?? null;
}

async function fetchLiveHandover(supabase: LiveClient, patientId: string) {
  const result = await supabase
    .from("handover_notes")
    .select("id, patient_id, note, escalation_instruction, updated_by_id, created_at, updated_at")
    .eq("patient_id", patientId)
    .maybeSingle();

  ensureNoError(result, "Failed to load handover");
  return (result.data as HandoverRow | null) ?? null;
}

async function getLivePatientDirectoryName(
  supabase: LiveClient,
  session: SessionContext,
  profileId: string | null,
  fallback: string | null = null,
) {
  if (!profileId) {
    return fallback ?? null;
  }

  const store = await getStoreForSession(session);
  return getPatientDirectoryName(store, profileId, fallback);
}

function revalidateWardflowPaths(patientId?: string) {
  revalidatePath("/wards");
  revalidatePath("/discharged");
  revalidatePath("/handover");
  revalidatePath("/handover/tasks");
  revalidatePath("/my-tasks");
  revalidatePath("/tasks/bulk");
  revalidatePath("/tasks/quick");
  revalidatePath("/admin/wards");
  revalidatePath("/admin/task-templates");
  if (patientId) {
    revalidatePath(`/patients/${patientId}`);
    revalidatePath(`/discharged/${patientId}`);
  }
}

export async function getWardSummaries(session: SessionContext): Promise<WardSummary[]> {
  const input = await getStoreForSession(session);
  return buildWardSummary(input, session, "active");
}

export async function getWardOverviewData(session: SessionContext): Promise<WardOverviewData> {
  return getWardOverviewDataCached(
    session.mode,
    session.profile.id,
    session.profile.role,
    session.profile.wardAssignment,
  );
}

export async function getDischargedSummaries(session: SessionContext): Promise<WardSummary[]> {
  const input = await getStoreForSession(session);
  return buildWardSummary(input, session, "discharged");
}

export async function getDischargedDirectory(
  session: SessionContext,
  options: { wardId?: string | null; query?: string | null; page?: number; pageSize?: number } = {},
) {
  const input = await getStoreForSession(session);
  const wardId = options.wardId?.trim() || null;
  const query = options.query?.trim().toLowerCase() || "";
  const pageSize = options.pageSize ?? 10;
  const page = Math.max(1, options.page ?? 1);
  const wardIds = visibleWardIds(input, session);

  const filtered = input.patients
    .filter(
      (patient) =>
        patient.lifecycle === "discharged" &&
        (canViewAllWards(session) || wardIds.includes(patient.wardId)),
    )
    .filter((patient) => (wardId ? patient.wardId === wardId : true))
    .filter((patient) =>
      query
        ? patient.displayName.toLowerCase().includes(query) ||
          patient.diagnosis.toLowerCase().includes(query) ||
          patient.bed.toLowerCase().includes(query)
        : true,
    )
    .sort((left, right) => (right.dischargedAt ?? "").localeCompare(left.dischargedAt ?? ""));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (Math.min(page, totalPages) - 1) * pageSize;
  const items: DischargedDirectoryItem[] = filtered.slice(start, start + pageSize).map((patient) => ({
    patient,
    ward: input.wards.find((ward) => ward.id === patient.wardId) ?? null,
    summary: summaryByPatientId(input, patient.id),
  }));

  return {
    items,
    wards: input.wards.filter((ward) => wardIds.includes(ward.id)),
    total,
    page: Math.min(page, totalPages),
    totalPages,
    pageSize,
  };
}

export async function hardDeletePatient(patientId: string, session: SessionContext) {
  requirePatientManager(session);
  const parsed = deletePatientSchema.parse({ patientId });

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const patient = patientById(store, parsed.patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    requireWardWriteAccess(session, patient.wardId);

    if (patient.lifecycle !== "discharged") {
      throw new Error("Only discharged patients can be hard deleted");
    }

    addActivityToDemoStore(
      session,
      patient.id,
      "patient.hard_deleted",
      "patient",
      patient.id,
      patient,
      null,
    );

    const deletedTaskIds = store.tasks
      .filter((entry) => entry.patientId === parsed.patientId)
      .map((entry) => entry.id);
    store.patients = store.patients.filter((entry) => entry.id !== parsed.patientId);
    store.problems = store.problems.filter((entry) => entry.patientId !== parsed.patientId);
    store.tasks = store.tasks.filter((entry) => entry.patientId !== parsed.patientId);
    store.taskUpdates = store.taskUpdates.filter((entry) => !deletedTaskIds.includes(entry.taskId));
    store.handovers = store.handovers.filter((entry) => entry.patientId !== parsed.patientId);
    store.dischargeSummaries = store.dischargeSummaries.filter(
      (entry) => entry.patientId !== parsed.patientId,
    );

    await persistDemoStore();
    revalidateWardflowPaths(parsed.patientId);
    return;
  }

  const supabase = await getLiveClient();
  const patient = await fetchLivePatient(supabase, parsed.patientId);
  if (!patient) {
    throw new Error("Patient not found");
  }

  requireWardWriteAccess(session, patient.ward_id);

  if (patient.lifecycle !== "discharged") {
    throw new Error("Only discharged patients can be hard deleted");
  }

  await insertActivityLog(supabase, {
    patient_id: patient.id,
    actor_id: session.profile.id,
    actor_name: session.profile.name,
    action: "patient.hard_deleted",
    entity_type: "patient",
    entity_id: patient.id,
    before_json: patient,
    after_json: null,
  });

  const result = await supabase.from("patients").delete().eq("id", parsed.patientId);
  ensureNoError(result, "Failed to delete patient");
  revalidateWardflowPaths(parsed.patientId);
}

export async function getDischargeSummaryById(session: SessionContext, summaryId: string) {
  const input = await getStoreForSession(session);
  const summary = input.dischargeSummaries.find((entry) => entry.id === summaryId) ?? null;
  if (!summary) return null;
  const patient = patientById(input, summary.patientId);
  if (!patient) return null;
  requireWardReadAccess(session, patient.wardId);

  return {
    summary,
    patient,
    ward: input.wards.find((ward) => ward.id === patient.wardId) ?? null,
  };
}

export async function getDischargeSummaryByPatientId(session: SessionContext, patientId: string) {
  const input = await getStoreForSession(session);
  const patient = patientById(input, patientId);
  if (!patient) return null;
  requireWardReadAccess(session, patient.wardId);

  const summary = summaryByPatientId(input, patientId);
  if (!summary) return null;

  return {
    summary,
    patient,
    ward: input.wards.find((ward) => ward.id === patient.wardId) ?? null,
  };
}

export async function getDischargeDraft(session: SessionContext, patientId: string) {
  const input = await getStoreForSession(session);
  const patient = patientById(input, patientId);
  if (!patient) return null;
  requireWardReadAccess(session, patient.wardId);
  return buildDischargeDraft(input, patientId);
}

export async function getWardDetail(session: SessionContext, wardId: string) {
  const input = await getStoreForSession(session);
  requireWardReadAccess(session, wardId);
  const summaries = buildWardSummary(input, session, "active");
  return summaries.find((summary) => summary.ward.id === wardId) ?? null;
}

export async function getPatientBundle(
  session: SessionContext,
  patientId: string,
): Promise<PatientBundle | null> {
  const input = await getStoreForSession(session);
  const patient = patientById(input, patientId);
  if (!patient) return null;
  requireWardReadAccess(session, patient.wardId);

  return {
    patient,
    ward: input.wards.find((ward) => ward.id === patient.wardId) ?? null,
    problems: input.problems
      .filter((problem) => problem.patientId === patientId)
      .sort((left, right) => {
        const priorityDiff = compareProblemPriority(left.priority, right.priority);
        if (priorityDiff !== 0) return priorityDiff;
        return left.sortOrder - right.sortOrder;
      }),
    tasks: attachTaskUpdates(
      input,
      input.tasks
        .filter((task) => task.patientId === patientId)
        .sort((left, right) => {
          const priorityDiff = compareTaskPriority(left.priority, right.priority);
          if (priorityDiff !== 0) return priorityDiff;
          const dueDiff = (left.dueAt ?? "").localeCompare(right.dueAt ?? "");
          if (dueDiff !== 0) return dueDiff;
          return right.updatedAt.localeCompare(left.updatedAt);
        }),
    ),
    handover: input.handovers.find((handover) => handover.patientId === patientId) ?? null,
    activity: input.activity
      .filter((activity) => activity.patientId === patientId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
}

export async function getSummaryNotePayloadByPatientId(
  session: SessionContext,
  patientId: string,
): Promise<SummaryNotePayload | null> {
  const bundle = await getPatientBundle(session, patientId);
  if (!bundle) {
    return null;
  }

  return buildSummaryNotePayload(bundle);
}

export async function exportSummaryNoteDocument(
  session: SessionContext,
  patientId: string,
): Promise<SummaryNoteExportResult> {
  const payload = await getSummaryNotePayloadByPatientId(session, patientId);
  if (!payload) {
    throw new Error("Patient not found");
  }

  return exportSummaryNoteToGoogleDocs(payload);
}

export async function getProfiles(session: SessionContext) {
  const input = await getStoreForSession(session);
  return getVisibleProfiles(input, session);
}

export async function getAssignableProfilesForWard(session: SessionContext, wardId: string) {
  const input = await getStoreForSession(session);
  requireWardReadAccess(session, wardId);
  return getProfilesForWard(input, wardId).sort((left, right) => left.name.localeCompare(right.name));
}

export async function getVisibleWards(session: SessionContext) {
  const input = await getStoreForSession(session);
  const wardIds = visibleWardIds(input, session);
  return input.wards
    .filter((ward) => wardIds.includes(ward.id))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function profileToStudent(profile: UserProfile): Student {
  return {
    id: profile.id,
    name: profile.name,
    studentCode: profile.studentCode ?? null,
    academicYear: profile.academicYear ?? null,
    isActive: profile.isActive ?? true,
    createdAt: profile.createdAt ?? null,
    updatedAt: profile.updatedAt ?? null,
    wardAssignment: profile.wardAssignment ?? null,
  };
}

function getStudentDirectory(input: DemoStore): Student[] {
  return input.profiles
    .filter((profile) => profile.role === "student" && (profile.isActive ?? true))
    .map(profileToStudent)
    .sort((left, right) => left.name.localeCompare(right.name, "th"));
}

function getEffectiveActiveStudentAssignments(input: DemoStore): StudentWardAssignment[] {
  const explicitAssignments = input.studentWardAssignments.filter((assignment) => assignment.isActive);
  const byStudentId = new Map(explicitAssignments.map((assignment) => [assignment.studentId, assignment]));

  for (const profile of input.profiles) {
    if (profile.role !== "student" || !(profile.isActive ?? true) || !profile.wardAssignment) {
      continue;
    }

    if (!byStudentId.has(profile.id)) {
      const timestamp = profile.updatedAt ?? profile.createdAt ?? now();
      byStudentId.set(profile.id, {
        id: `student-assignment-profile-${profile.id}`,
        studentId: profile.id,
        wardId: profile.wardAssignment,
        assignedByUserId: null,
        assignedAt: timestamp,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }

  return [...byStudentId.values()];
}

function buildStudentWardAssignmentBoardData(input: DemoStore): StudentWardAssignmentBoardData {
  const students = getStudentDirectory(input);
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const activeAssignments = getEffectiveActiveStudentAssignments(input);
  const wards = [...input.wards]
    .filter((ward) => ward.isActive ?? true)
    .sort((left, right) => left.name.localeCompare(right.name, "th"))
    .map((ward): StudentWardAssignmentWard => {
      const assignments: StudentWardAssignmentEntry[] = activeAssignments
        .filter((assignment) => assignment.isActive && assignment.wardId === ward.id)
        .map((assignment) => ({
          assignment,
          student: studentMap.get(assignment.studentId),
        }))
        .filter((entry): entry is StudentWardAssignmentEntry => Boolean(entry.student))
        .sort((left, right) => left.student.name.localeCompare(right.student.name, "th"));

      return {
        ward,
        assignments,
        assignedStudentCount: assignments.length,
      };
    });

  return { wards, students };
}

export async function getStudentWardAssignmentBoardData(
  session: SessionContext,
): Promise<StudentWardAssignmentBoardData> {
  if (!canManageAdmin(session)) {
    throw new Error("Admin only");
  }

  const input = await getStoreForSession(session);
  return buildStudentWardAssignmentBoardData(input);
}

export async function getTaskTemplates(session?: SessionContext) {
  if (!session || session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    return [...store.templates].sort((left, right) => left.title.localeCompare(right.title));
  }

  const input = await getStoreForSession(session);
  return [...input.templates].sort((left, right) => left.title.localeCompare(right.title));
}

function sortTaskWorkflowItems(
  left: { task: TaskWithUpdates; patient: Patient; ward: Ward | null },
  right: { task: TaskWithUpdates; patient: Patient; ward: Ward | null },
) {
  const priorityDiff = compareTaskPriority(left.task.priority, right.task.priority);
  if (priorityDiff !== 0) return priorityDiff;
  if (left.task.status !== right.task.status) {
    if (left.task.status === "blocked") return -1;
    if (right.task.status === "blocked") return 1;
  }
  const updatedDiff = right.task.updatedAt.localeCompare(left.task.updatedAt);
  if (updatedDiff !== 0) return updatedDiff;
  const wardDiff = (left.ward?.name ?? "").localeCompare(right.ward?.name ?? "");
  if (wardDiff !== 0) return wardDiff;
  const bedDiff = compareBed(left.patient.bed, right.patient.bed);
  if (bedDiff !== 0) return bedDiff;
  return left.task.title.localeCompare(right.task.title);
}

function buildTaskWorkspaceItems(input: DemoStore, session: SessionContext) {
  const wardIds = new Set(visibleWardIds(input, session));
  const patientMap = new Map(
    input.patients
      .filter((patient) => patient.lifecycle === "active" && wardIds.has(patient.wardId))
      .map((patient) => [patient.id, patient]),
  );
  const wardMap = new Map(input.wards.map((ward) => [ward.id, ward]));

  return attachTaskUpdates(
    input,
    input.tasks.filter((task) => patientMap.has(task.patientId)),
  )
    .map((task) => ({
      task,
      patient: patientMap.get(task.patientId)!,
      ward: wardMap.get(patientMap.get(task.patientId)!.wardId) ?? null,
    }))
    .sort(sortTaskWorkflowItems);
}

function groupTaskWorkspaceItems(
  items: Array<{ task: TaskWithUpdates; patient: Patient; ward: Ward | null }>,
  includeDone: boolean,
): TaskWorkspaceGroup[] {
  const wardMap = new Map<string, TaskWorkspaceGroup>();

  for (const item of items) {
    if (!item.ward) continue;
    if (!includeDone && item.task.status === "done") continue;
    if (includeDone && item.task.status !== "done") continue;

    const wardGroup =
      wardMap.get(item.ward.id) ??
      {
        ward: item.ward,
        patients: [],
      };

    let patientGroup = wardGroup.patients.find((patient) => patient.id === item.patient.id);
    if (!patientGroup) {
      patientGroup = {
        ...item.patient,
        tasks: [],
      };
      wardGroup.patients.push(patientGroup);
    }

    patientGroup.tasks.push(item.task);
    wardMap.set(item.ward.id, wardGroup);
  }

  return [...wardMap.values()]
    .map((group) => ({
      ...group,
      patients: group.patients
        .map((patient) => ({
          ...patient,
          tasks: [...patient.tasks].sort((left, right) => sortTaskWorkflowItems(
            { task: left, patient, ward: group.ward },
            { task: right, patient, ward: group.ward },
          )),
        }))
        .sort((left, right) => compareBed(left.bed, right.bed)),
    }))
    .sort((left, right) => left.ward.name.localeCompare(right.ward.name));
}

export async function getMyTasks(session: SessionContext, filters?: Partial<TaskWorkspaceFilters>) {
  const input = await getStoreForSession(session);
  const items = buildTaskWorkspaceItems(input, session).filter(({ task, patient }) => {
    if (filters?.wardId && patient.wardId !== filters.wardId) return false;
    if (filters?.ownerId && task.ownerId !== filters.ownerId) return false;
    if (filters?.type && task.type !== filters.type) return false;
    return true;
  });

  return {
    blockedByMissingWard: isStudentAwaitingWardAssignment(session),
    wards: input.wards.filter((ward) => visibleWardIds(input, session).includes(ward.id)),
    profiles: getVisibleProfiles(input, session),
    profilesByWard: Object.fromEntries(
      input.wards.map((ward) => [
        ward.id,
        getProfilesForWard(input, ward.id).sort((left, right) => left.name.localeCompare(right.name)),
      ]),
    ) as Record<string, UserProfile[]>,
    activeGroups: groupTaskWorkspaceItems(items, false),
    archivedGroups: groupTaskWorkspaceItems(items, true),
  };
}

export async function getHandoverBundles(session: SessionContext): Promise<HandoverBundle[]> {
  const input = await getStoreForSession(session);
  const summaries = buildWardSummary(input, session, "active");

  return summaries.map((summary) => ({
    ward: summary.ward,
    patients: summary.patients
      .map((patient) => ({
        ...patient,
        problems: input.problems.filter(
          (problem) => problem.patientId === patient.id && problem.status !== "resolved",
        ),
        tasks: attachTaskUpdates(
          input,
          input.tasks.filter((task) => task.patientId === patient.id && task.status !== "done"),
        ),
        handover: input.handovers.find((handover) => handover.patientId === patient.id) ?? null,
      }))
      .sort((left, right) => {
        const weight = (status: Patient["status"]) =>
          status === "critical" ? 0 : status === "watch" ? 1 : 2;
        return weight(left.status) - weight(right.status);
      }),
  }));
}

export async function getHandoverStructuredText(session: SessionContext, wardId?: string | null) {
  const bundles = await getHandoverBundles(session);
  const selected = wardId ? bundles.filter((bundle) => bundle.ward.id === wardId) : bundles;

  return selected
    .map((bundle) => {
      const patientLines = bundle.patients
        .filter(
          (patient) =>
            patient.status !== "stable" ||
            patient.tasks.some((task) => task.status !== "done") ||
            patient.problems.some((problem) => problem.watchOut || problem.pending),
        )
        .map((patient) => {
          const watchItems = patient.problems
            .map((problem) => problem.watchOut)
            .filter((value): value is string => Boolean(value));
          const pendingItems = [
            ...patient.problems
              .map((problem) => problem.pending)
              .filter((value): value is string => Boolean(value)),
            ...patient.tasks
              .filter((task) => task.status !== "done")
              .map((task) => task.title),
          ];

          return [
            `${patient.displayName} (Bed ${patient.bed}) - ${patient.diagnosis}`,
            `Status: ${patient.status}`,
            watchItems.length ? `Watch: ${watchItems.join("; ")}` : "",
            pendingItems.length ? `Pending: ${pendingItems.join("; ")}` : "",
            patient.handover?.note ? `Note: ${patient.handover.note}` : "",
            patient.handover?.escalationInstruction
              ? `Observe: ${patient.handover.escalationInstruction}`
              : "",
          ]
            .filter(Boolean)
            .join("\n");
        });

      return [`Ward: ${bundle.ward.name}`, ...patientLines].join("\n\n");
    })
    .join("\n\n--------------------\n\n");
}

export async function getBulkTaskEntryData(session: SessionContext) {
  const input = await getStoreForSession(session);
  const summaries = buildWardSummary(input, session, "active").map((summary) => ({
    ...summary,
    patients: [...summary.patients].sort((left, right) => compareBed(left.bed, right.bed)),
  }));

  return {
    blockedByMissingWard: isStudentAwaitingWardAssignment(session),
    wardSummaries: summaries,
    templates: [...input.templates].sort((left, right) => left.title.localeCompare(right.title)),
    profilesByWard: Object.fromEntries(
      input.wards.map((ward) => [
        ward.id,
        getProfilesForWard(input, ward.id).sort((left, right) => left.name.localeCompare(right.name)),
      ]),
    ) as Record<string, UserProfile[]>,
    defaultWardId:
      canViewAllWards(session) || !session.profile.wardAssignment ? "" : session.profile.wardAssignment,
  };
}

export async function getPendingTaskHandoverData(
  session: SessionContext,
  filters?: Partial<PendingTaskHandoverFilters>,
) {
  const input = await getStoreForSession(session);
  const items = buildTaskWorkspaceItems(input, session).filter(({ task, patient }) => {
    if (task.status === "done") return false;
    if (filters?.wardId && patient.wardId !== filters.wardId) return false;
    if (filters?.mode === "mine" && task.ownerId !== session.profile.id) return false;
    if (filters?.mode === "blocked" && task.status !== "blocked") return false;
    return true;
  });

  return {
    blockedByMissingWard: isStudentAwaitingWardAssignment(session),
    wards: input.wards.filter((ward) => visibleWardIds(input, session).includes(ward.id)),
    groups: groupTaskWorkspaceItems(items, false),
  };
}

export async function getPendingTaskHandoverText(
  session: SessionContext,
  filters?: Partial<PendingTaskHandoverFilters>,
) {
  const data = await getPendingTaskHandoverData(session, filters);
  const selectedGroups = filters?.wardId
    ? data.groups.filter((group) => group.ward.id === filters.wardId)
    : data.groups;
  const wardName =
    selectedGroups.length === 1 ? selectedGroups[0].ward.name : "All visible wards";

  const lines = [`Pending Task Handover | ${wardName} | ${now()}`];

  for (const group of selectedGroups) {
    lines.push("");
    lines.push(`Ward ${group.ward.name}`);

    for (const patient of group.patients) {
      lines.push(`Bed ${patient.bed} | ${patient.displayName} | ${patient.diagnosis}`);
      for (const task of patient.tasks) {
        lines.push(
          `- [${labelForTaskPriority(task.priority)}][${labelForTaskStatus(task.status)}] ${task.title} — owner: ${task.ownerName ?? "Unassigned"}`,
        );
        if (task.blockedReason) {
          lines.push(`  Blocked: ${task.blockedReason}`);
        }
        if (task.updates[0]) {
          lines.push(`  Update: ${task.updates[0].note}`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n").trim();
}

export async function saveWard(formData: FormData, session: SessionContext) {
  if (!canManageAdmin(session)) {
    throw new Error("Admin only");
  }

  const parsed = wardSchema.parse({
    id: textOrNull(formData.get("id")) ?? undefined,
    name: formData.get("name"),
  });

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();

    if (parsed.id) {
      const ward = store.wards.find((entry) => entry.id === parsed.id);
      if (!ward) throw new Error("Ward not found");
      ward.name = parsed.name;
    } else {
      store.wards.push({ id: nextId("ward"), name: parsed.name });
    }

    await persistDemoStore();
    revalidateWardflowPaths();
    return;
  }

  const supabase = await getLiveClient();
  if (parsed.id) {
    const result = await supabase.from("wards").update({ name: parsed.name }).eq("id", parsed.id);
    ensureNoError(result, "Failed to update ward");
  } else {
    const result = await supabase.from("wards").insert({
      id: nextId("ward"),
      name: parsed.name,
    });
    ensureNoError(result, "Failed to create ward");
  }

  revalidateWardflowPaths();
}

export async function deleteWard(formData: FormData, session: SessionContext) {
  if (!canManageAdmin(session)) {
    throw new Error("Admin only");
  }

  const parsed = deleteWardSchema.parse({
    wardId: formData.get("wardId"),
  });

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const patientsInWard = store.patients.filter((patient) => patient.wardId === parsed.wardId);
    const dischargeTimestamp = now();

    patientsInWard.forEach((patient) => {
      const before = structuredClone(patient);
      patient.lifecycle = "discharged";
      patient.dischargedAt = patient.dischargedAt ?? dischargeTimestamp;
      patient.lastUpdate = dischargeTimestamp;
      addActivityToDemoStore(
        session,
        patient.id,
        "patient.auto_discharged_on_ward_delete",
        "patient",
        patient.id,
        before,
        patient,
      );
    });

    store.wards = store.wards.filter((ward) => ward.id !== parsed.wardId);
    store.studentWardAssignments = store.studentWardAssignments.map((assignment) =>
      assignment.wardId === parsed.wardId && assignment.isActive
        ? { ...assignment, isActive: false, updatedAt: dischargeTimestamp }
        : assignment,
    );
    store.profiles = store.profiles.map((profile) =>
      profile.wardAssignment === parsed.wardId ? { ...profile, wardAssignment: null } : profile,
    );

    await persistDemoStore();
    revalidateWardflowPaths();
    return;
  }

  const supabase = await getLiveClient();
  const patientsResult = await supabase
    .from("patients")
    .select(
      "id, ward_id, bed, display_name, age, sex, diagnosis, status, responsible_doctor_id, allergy, precaution, code_status, lifecycle, updated_by_id, discharged_at, created_at, updated_at",
    )
    .eq("ward_id", parsed.wardId);
  ensureNoError(patientsResult, "Failed to load ward patients");

  const patients = (patientsResult.data ?? []) as PatientRow[];
  const dischargeTimestamp = now();

  for (const patient of patients) {
    await insertActivityLog(supabase, {
      patient_id: patient.id,
      actor_id: session.profile.id,
      actor_name: session.profile.name,
      action: "patient.auto_discharged_on_ward_delete",
      entity_type: "patient",
      entity_id: patient.id,
      before_json: patient,
      after_json: {
        ...patient,
        lifecycle: "discharged",
        discharged_at: patient.discharged_at ?? dischargeTimestamp,
      },
    });
  }

  const dischargeResult = await supabase
    .from("patients")
    .update({
      lifecycle: "discharged",
      discharged_at: dischargeTimestamp,
      updated_by_id: session.profile.id,
    })
    .eq("ward_id", parsed.wardId)
    .eq("lifecycle", "active");
  ensureNoError(dischargeResult, "Failed to auto-discharge ward patients");

  const clearAssignmentsResult = await supabase
    .from("profiles")
    .update({ ward_assignment: null })
    .eq("ward_assignment", parsed.wardId);
  ensureNoError(clearAssignmentsResult, "Failed to clear ward assignment");

  const deleteResult = await supabase.from("wards").delete().eq("id", parsed.wardId);
  ensureNoError(deleteResult, "Failed to delete ward");
  revalidateWardflowPaths();
}

export async function updateUserRole(formData: FormData, session: SessionContext) {
  if (!canManageAdmin(session)) {
    throw new Error("Admin only");
  }

  const parsed = userRoleSchema.parse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    wardAssignment: textOrNull(formData.get("wardAssignment")),
  });
  const nextWardAssignment = parsed.role === "student" ? (parsed.wardAssignment ?? null) : null;

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const profile = store.profiles.find((entry) => entry.id === parsed.userId);
    if (!profile) throw new Error("User not found");
    profile.role = parsed.role;
    profile.wardAssignment = nextWardAssignment;
    await persistDemoStore();
    revalidateWardflowPaths();
    return;
  }

  const supabase = await getLiveClient();
  const result = await supabase
    .from("profiles")
    .update({ role: parsed.role, ward_assignment: nextWardAssignment })
    .eq("id", parsed.userId);
  ensureNoError(result, "Failed to update user role");
  revalidateWardflowPaths();
}

export async function saveStudentWardAssignments(
  input: z.input<typeof saveStudentWardAssignmentsSchema>,
  session: SessionContext,
) {
  if (!canManageAdmin(session)) {
    throw new Error("Admin only");
  }

  const parsed = saveStudentWardAssignmentsSchema.parse({
    wardId: input.wardId,
    studentIds: [...new Set(input.studentIds ?? [])],
    forceMove: input.forceMove ?? false,
  });

  if (parsed.studentIds.length !== (input.studentIds ?? []).length) {
    throw new Error("Duplicate student selection is not allowed");
  }

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const ward = store.wards.find((entry) => entry.id === parsed.wardId && (entry.isActive ?? true));
    if (!ward) {
      throw new Error("Ward not found");
    }

    const students = store.profiles.filter(
      (profile) =>
        profile.role === "student" &&
        (profile.isActive ?? true) &&
        parsed.studentIds.includes(profile.id),
    );
    if (students.length !== parsed.studentIds.length) {
      throw new Error("One or more selected students are unavailable");
    }

    const activeAssignments = getEffectiveActiveStudentAssignments(store);
    const conflicts = students
      .map((student) => ({
        student,
        assignment:
          activeAssignments.find(
            (assignment) => assignment.studentId === student.id && assignment.wardId !== parsed.wardId,
          ) ?? null,
      }))
      .filter((entry) => entry.assignment);

    if (conflicts.length > 0 && !parsed.forceMove) {
      throw new Error(
        `MOVE_REQUIRED:${JSON.stringify(
          conflicts.map((entry) => ({
            studentId: entry.student.id,
            studentName: entry.student.name,
            fromWardId: entry.assignment?.wardId ?? null,
          })),
        )}`,
      );
    }

    const timestamp = now();
    const impactedStudentIds = new Set<string>();

    store.studentWardAssignments = store.studentWardAssignments.map((assignment) => {
      const shouldDeactivate =
        assignment.isActive &&
        (assignment.wardId === parsed.wardId || parsed.studentIds.includes(assignment.studentId));
      if (!shouldDeactivate) {
        return assignment;
      }

      impactedStudentIds.add(assignment.studentId);
      return { ...assignment, isActive: false, updatedAt: timestamp };
    });

    for (const studentId of parsed.studentIds) {
      impactedStudentIds.add(studentId);
      store.studentWardAssignments.push({
        id: nextId("student-assignment"),
        studentId,
        wardId: parsed.wardId,
        assignedByUserId: session.profile.id,
        assignedAt: timestamp,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    store.profiles = store.profiles.map((profile) => {
      if (!impactedStudentIds.has(profile.id) || profile.role !== "student") {
        return profile;
      }

      const nextAssignment = parsed.studentIds.includes(profile.id) ? parsed.wardId : null;
      return {
        ...profile,
        wardAssignment: nextAssignment,
        updatedAt: timestamp,
      };
    });

    await persistDemoStore();
    revalidateWardflowPaths();

    return {
      wardId: parsed.wardId,
      movedStudents: conflicts.map((entry) => ({
        studentId: entry.student.id,
        studentName: entry.student.name,
        fromWardId: entry.assignment?.wardId ?? null,
      })),
    };
  }

  const supabase = await getLiveClient();
  const rpcResult = await supabase.rpc("admin_save_student_ward_assignments", {
    target_ward_id: parsed.wardId,
    target_student_ids: parsed.studentIds,
    force_move: parsed.forceMove,
  });
  ensureNoError(rpcResult, "Failed to save student ward assignments");
  revalidateWardflowPaths();

  return (rpcResult.data ?? {}) as {
    wardId?: string;
    movedStudents?: Array<{ studentId: string; studentName: string; fromWardId: string | null }>;
  };
}

export async function removeStudentWardAssignment(
  input: z.input<typeof removeStudentWardAssignmentSchema>,
  session: SessionContext,
) {
  if (!canManageAdmin(session)) {
    throw new Error("Admin only");
  }

  const parsed = removeStudentWardAssignmentSchema.parse(input);

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const timestamp = now();
    const assignment = store.studentWardAssignments.find(
      (entry) => entry.id === parsed.assignmentId && entry.isActive,
    );
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    store.studentWardAssignments = store.studentWardAssignments.map((entry) =>
      entry.id === parsed.assignmentId ? { ...entry, isActive: false, updatedAt: timestamp } : entry,
    );
    store.profiles = store.profiles.map((profile) =>
      profile.id === assignment.studentId
        ? { ...profile, wardAssignment: null, updatedAt: timestamp }
        : profile,
    );

    await persistDemoStore();
    revalidateWardflowPaths();
    return { assignmentId: parsed.assignmentId };
  }

  const supabase = await getLiveClient();
  const rpcResult = await supabase.rpc("admin_remove_student_ward_assignment", {
    target_assignment_id: parsed.assignmentId,
  });
  ensureNoError(rpcResult, "Failed to remove student ward assignment");
  revalidateWardflowPaths();

  return (rpcResult.data ?? {}) as { assignmentId?: string };
}

export async function deleteUser(formData: FormData, session: SessionContext) {
  if (!canManageAdmin(session)) {
    throw new Error("Admin only");
  }

  const parsed = deleteUserSchema.parse({
    userId: formData.get("userId"),
  });

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const profile = store.profiles.find((entry) => entry.id === parsed.userId);
    if (!profile) {
      throw new Error("User not found");
    }

    if (profile.role === "admin") {
      throw new Error("Admin user cannot be deleted");
    }

    store.patients = store.patients.map((patient) =>
      patient.responsibleDoctorId === parsed.userId
        ? { ...patient, responsibleDoctorId: null, responsibleDoctorName: null, lastUpdate: now() }
        : patient,
    );

    store.tasks = store.tasks.map((task) => ({
      ...task,
      ownerId: task.ownerId === parsed.userId ? null : task.ownerId,
      ownerName: task.ownerId === parsed.userId ? null : task.ownerName,
      updatedById: task.updatedById === parsed.userId ? null : task.updatedById,
      updatedByName: task.updatedById === parsed.userId ? null : task.updatedByName,
      updatedAt: now(),
    }));

    store.dischargeSummaries = store.dischargeSummaries.map((summary) =>
      summary.createdById === parsed.userId ? { ...summary, createdById: null } : summary,
    );

    store.activity = store.activity.map((entry) =>
      entry.actorId === parsed.userId ? { ...entry, actorId: null } : entry,
    );
    store.studentWardAssignments = store.studentWardAssignments.filter(
      (entry) => entry.studentId !== parsed.userId && entry.assignedByUserId !== parsed.userId,
    );

    store.profiles = store.profiles.filter((entry) => entry.id !== parsed.userId);
    await persistDemoStore();
    revalidateWardflowPaths();
    return;
  }

  const supabase = await getLiveClient();
  const profileResult = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", parsed.userId)
    .maybeSingle();
  ensureNoError(profileResult, "Failed to load user profile");

  const profile = profileResult.data as { id: string; role: Role } | null;
  if (!profile) {
    throw new Error("User not found");
  }

  if (profile.role === "admin") {
    throw new Error("Admin user cannot be deleted");
  }

  ensureNoError(
    await supabase
      .from("patients")
      .update({ responsible_doctor_id: null, updated_by_id: session.profile.id })
      .eq("responsible_doctor_id", parsed.userId),
    "Failed to clear patient owner",
  );

  ensureNoError(
    await supabase
      .from("ward_tasks")
      .update({ owner_id: null, updated_by_id: session.profile.id })
      .eq("owner_id", parsed.userId),
    "Failed to clear task owner",
  );

  const studentAssignmentsDeleteResult = await supabase
    .from("student_ward_assignments")
    .delete()
    .or(`student_id.eq.${parsed.userId},assigned_by_user_id.eq.${parsed.userId}`);
  if (
    studentAssignmentsDeleteResult.error &&
    !isRecoverableStudentAssignmentReadError(studentAssignmentsDeleteResult.error)
  ) {
    ensureNoError(studentAssignmentsDeleteResult, "Failed to clear student ward assignments");
  }

  ensureNoError(
    await supabase
      .from("discharge_summaries")
      .update({ created_by_id: null })
      .eq("created_by_id", parsed.userId),
    "Failed to clear discharge summary author",
  );

  ensureNoError(
    await supabase.from("activity_logs").update({ actor_id: null }).eq("actor_id", parsed.userId),
    "Failed to clear activity actor",
  );

  const admin = createAdminSupabaseClient();
  if (!admin) {
    throw new Error("Supabase admin client unavailable");
  }

  const result = await admin.auth.admin.deleteUser(parsed.userId);
  if (result.error) {
    throw new Error(`Failed to delete user: ${result.error.message}`);
  }

  revalidateWardflowPaths();
}

export async function savePatient(formData: FormData, session: SessionContext): Promise<string> {
  const hasUnderlyingDiseaseField = formData.has("underlyingDisease");
  const parsed = patientSchema.parse({
    id: textOrNull(formData.get("id")) ?? undefined,
    wardId: formData.get("wardId"),
    bed: formData.get("bed"),
    displayName: formData.get("displayName"),
    ageText: textOrNull(formData.get("age")),
    sex: textOrNull(formData.get("sex")),
    underlyingDisease: hasUnderlyingDiseaseField ? textOrNull(formData.get("underlyingDisease")) : undefined,
    diagnosis: formData.get("diagnosis"),
    status: formData.get("status"),
    responsibleDoctorId: textOrNull(formData.get("responsibleDoctorId")),
    precaution: formData.get("precaution"),
    updatedAt: textOrNull(formData.get("updatedAt")),
  });
  const parsedAge = parseAgeInput(parsed.ageText);

  requireWardWriteAccess(session, parsed.wardId);

  if (parsed.id) {
    requirePatientManager(session);
  } else {
    requirePatientManager(session);
  }

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const ownerName = getPatientDirectoryName(
      store,
      parsed.responsibleDoctorId ?? null,
      session.profile.name,
    );
    let savedPatientId = parsed.id ?? "";

    if (parsed.id) {
      const existing = patientById(store, parsed.id);
      if (!existing) throw new Error("Patient not found");
      assertNoConflict(parsed.updatedAt, existing.lastUpdate, "patient");

      const before = structuredClone(existing);
      existing.wardId = parsed.wardId;
      existing.bed = parsed.bed;
      existing.displayName = parsed.displayName;
      existing.age = parsedAge;
      existing.sex = parsed.sex ?? null;
      if (hasUnderlyingDiseaseField) {
        existing.underlyingDisease = parsed.underlyingDisease ?? null;
      }
      existing.diagnosis = parsed.diagnosis;
      existing.status = parsed.status;
      existing.responsibleDoctorId = parsed.responsibleDoctorId ?? session.profile.id;
      existing.responsibleDoctorName = ownerName;
      existing.precaution = parsed.precaution;
      existing.lastUpdate = now();
      addActivityToDemoStore(
        session,
        existing.id,
        "patient.updated",
        "patient",
        existing.id,
        before,
        existing,
      );
      savedPatientId = existing.id;
    } else {
      const patient: Patient = {
        id: nextId("patient"),
        wardId: parsed.wardId,
        bed: parsed.bed,
        displayName: parsed.displayName,
        age: parsedAge,
        sex: parsed.sex ?? null,
        underlyingDisease: parsed.underlyingDisease ?? null,
        diagnosis: parsed.diagnosis,
        status: parsed.status,
        responsibleDoctorId: parsed.responsibleDoctorId ?? session.profile.id,
        responsibleDoctorName: ownerName,
        allergy: null,
        precaution: parsed.precaution,
        codeStatus: null,
        lifecycle: "active",
        dischargedAt: null,
        lastUpdate: now(),
      };
      store.patients.push(patient);
      addActivityToDemoStore(session, patient.id, "patient.created", "patient", patient.id, null, patient);
      savedPatientId = patient.id;
    }

    await persistDemoStore();
    revalidateWardflowPaths(parsed.id);
    return savedPatientId;
  }

  const supabase = await getLiveClient();
  const ownerName = await getLivePatientDirectoryName(
    supabase,
    session,
    parsed.responsibleDoctorId ?? session.profile.id,
    session.profile.name,
  );

  if (parsed.id) {
    const existing = await fetchLivePatient(supabase, parsed.id);
    if (!existing) {
      throw new Error("Patient not found");
    }

    requireWardWriteAccess(session, existing.ward_id);
    assertNoConflict(parsed.updatedAt, existing.updated_at, "patient");

    const fullUpdatePayload = {
      ward_id: parsed.wardId,
      bed: parsed.bed,
      display_name: parsed.displayName,
      age: parsedAge,
      sex: parsed.sex ?? null,
      underlying_disease: parsed.underlyingDisease ?? null,
      diagnosis: parsed.diagnosis,
      status: parsed.status,
      responsible_doctor_id: parsed.responsibleDoctorId ?? session.profile.id,
      precaution: parsed.precaution,
      updated_by_id: session.profile.id,
    };
    const legacyUpdatePayload = {
      ward_id: parsed.wardId,
      bed: parsed.bed,
      display_name: parsed.displayName,
      age: parsedAge,
      sex: parsed.sex ?? null,
      diagnosis: parsed.diagnosis,
      status: parsed.status,
      responsible_doctor_id: parsed.responsibleDoctorId ?? session.profile.id,
      precaution: parsed.precaution,
      updated_by_id: session.profile.id,
    };
    const result = await supabase.from("patients").update(fullUpdatePayload).eq("id", parsed.id);
    if (result.error && isRecoverablePatientUnderlyingSchemaError(result.error)) {
      ensureNoError(
        await supabase.from("patients").update(legacyUpdatePayload).eq("id", parsed.id),
        "Failed to update patient",
      );
    } else {
      ensureNoError(result, "Failed to update patient");
    }

    await insertActivityLog(supabase, {
      patient_id: existing.id,
      actor_id: session.profile.id,
      actor_name: session.profile.name,
      action: "patient.updated",
      entity_type: "patient",
      entity_id: existing.id,
      before_json: existing,
      after_json: {
        ...existing,
        ward_id: parsed.wardId,
        bed: parsed.bed,
        display_name: parsed.displayName,
        age: parsedAge,
        sex: parsed.sex ?? null,
        underlying_disease: parsed.underlyingDisease ?? null,
        diagnosis: parsed.diagnosis,
        status: parsed.status,
        responsible_doctor_id: parsed.responsibleDoctorId ?? session.profile.id,
        responsibleDoctorName: ownerName,
        precaution: parsed.precaution,
      },
    });
    revalidateWardflowPaths(parsed.id);
    return parsed.id;
  }

  const patientId = nextId("patient");
  const inserted = {
    id: patientId,
    ward_id: parsed.wardId,
    bed: parsed.bed,
    display_name: parsed.displayName,
    age: parsedAge,
    sex: parsed.sex ?? null,
    underlying_disease: parsed.underlyingDisease ?? null,
    diagnosis: parsed.diagnosis,
    status: parsed.status,
    responsible_doctor_id: parsed.responsibleDoctorId ?? session.profile.id,
    precaution: parsed.precaution,
    updated_by_id: session.profile.id,
  };
  const legacyInserted = {
    id: patientId,
    ward_id: parsed.wardId,
    bed: parsed.bed,
    display_name: parsed.displayName,
    age: parsedAge,
    sex: parsed.sex ?? null,
    diagnosis: parsed.diagnosis,
    status: parsed.status,
    responsible_doctor_id: parsed.responsibleDoctorId ?? session.profile.id,
    precaution: parsed.precaution,
    updated_by_id: session.profile.id,
  };
  const insertResult = await supabase.from("patients").insert(inserted);
  if (insertResult.error && isRecoverablePatientUnderlyingSchemaError(insertResult.error)) {
    ensureNoError(await supabase.from("patients").insert(legacyInserted), "Failed to create patient");
  } else {
    ensureNoError(insertResult, "Failed to create patient");
  }

  await insertActivityLog(supabase, {
    patient_id: patientId,
    actor_id: session.profile.id,
    actor_name: session.profile.name,
    action: "patient.created",
    entity_type: "patient",
    entity_id: patientId,
    before_json: null,
    after_json: {
      ...inserted,
      responsibleDoctorName: ownerName,
      lifecycle: "active",
      discharged_at: null,
    },
  });

  revalidateWardflowPaths(patientId);
  return patientId;
}

export async function dischargePatient(patientId: string, session: SessionContext) {
  requirePatientManager(session);

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const patient = patientById(store, patientId);
    if (!patient) throw new Error("Patient not found");
    requireWardWriteAccess(session, patient.wardId);

    const before = structuredClone(patient);
    patient.lifecycle = "discharged";
    patient.dischargedAt = now();
    patient.lastUpdate = patient.dischargedAt;
    addActivityToDemoStore(
      session,
      patient.id,
      "patient.discharged",
      "patient",
      patient.id,
      before,
      patient,
    );

    await persistDemoStore();
    revalidateWardflowPaths(patientId);
    return;
  }

  const supabase = await getLiveClient();
  const patient = await fetchLivePatient(supabase, patientId);
  if (!patient) throw new Error("Patient not found");
  requireWardWriteAccess(session, patient.ward_id);

  const dischargeTimestamp = now();
  ensureNoError(
    await supabase
      .from("patients")
      .update({
        lifecycle: "discharged",
        discharged_at: dischargeTimestamp,
        updated_by_id: session.profile.id,
      })
      .eq("id", patientId),
    "Failed to discharge patient",
  );

  await insertActivityLog(supabase, {
    patient_id: patientId,
    actor_id: session.profile.id,
    actor_name: session.profile.name,
    action: "patient.discharged",
    entity_type: "patient",
    entity_id: patientId,
    before_json: patient,
    after_json: {
      ...patient,
      lifecycle: "discharged",
      discharged_at: dischargeTimestamp,
    },
  });

  revalidateWardflowPaths(patientId);
}

export async function dischargePatientWithSummary(formData: FormData, session: SessionContext) {
  requirePatientManager(session);
  const parsed = dischargeSummarySchema.parse({
    patientId: formData.get("patientId"),
    patientUpdatedAt: textOrNull(formData.get("patientUpdatedAt")),
    primaryDiagnosis: formData.get("primaryDiagnosis"),
    hospitalCourse: String(formData.get("hospitalCourse") ?? ""),
    plan: String(formData.get("plan") ?? ""),
    homeMedication: String(formData.get("homeMedication") ?? ""),
  });

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const patient = patientById(store, parsed.patientId);
    if (!patient) throw new Error("Patient not found");
    requireWardWriteAccess(session, patient.wardId);
    assertNoConflict(parsed.patientUpdatedAt, patient.lastUpdate, "patient");

    const dischargeDate = now();
    const admitDate = getPatientAdmitDate(store, patient.id) ?? dischargeDate;
    const summary: DischargeSummary = {
      id: nextId("discharge-summary"),
      patientId: patient.id,
      wardId: patient.wardId,
      createdById: session.profile.id,
      createdByName: session.profile.name,
      createdAt: dischargeDate,
      admitDate,
      dischargeDate,
      lengthOfStay: getLengthOfStay(admitDate, dischargeDate),
      primaryDiagnosis: parsed.primaryDiagnosis,
      hospitalCourse: parsed.hospitalCourse,
      plan: parsed.plan,
      homeMedication: parsed.homeMedication,
    };

    store.dischargeSummaries = store.dischargeSummaries.filter((entry) => entry.patientId !== patient.id);
    store.dischargeSummaries.unshift(summary);
    addActivityToDemoStore(
      session,
      patient.id,
      "discharge.summary_created",
      "discharge_summary",
      summary.id,
      null,
      summary,
    );

    await persistDemoStore();
    await dischargePatient(patient.id, session);
    return summary.id;
  }

  const supabase = await getLiveClient();
  const patient = await fetchLivePatient(supabase, parsed.patientId);
  if (!patient) throw new Error("Patient not found");
  requireWardWriteAccess(session, patient.ward_id);
  assertNoConflict(parsed.patientUpdatedAt, patient.updated_at, "patient");

  const dischargeDate = now();
  const admitDate = patient.created_at ?? dischargeDate;
  const summaryId = nextId("discharge-summary");

  ensureNoError(
    await supabase.from("discharge_summaries").upsert(
      {
        id: summaryId,
        patient_id: patient.id,
        ward_id: patient.ward_id,
        created_by_id: session.profile.id,
        created_by_name: session.profile.name,
        created_at: dischargeDate,
        admit_date: admitDate,
        discharge_date: dischargeDate,
        length_of_stay: getLengthOfStay(admitDate, dischargeDate),
        primary_diagnosis: parsed.primaryDiagnosis,
        hospital_course: parsed.hospitalCourse,
        plan: parsed.plan,
        home_medication: parsed.homeMedication,
      },
      { onConflict: "patient_id" },
    ),
    "Failed to save discharge summary",
  );

  await insertActivityLog(supabase, {
    patient_id: patient.id,
    actor_id: session.profile.id,
    actor_name: session.profile.name,
    action: "discharge.summary_created",
    entity_type: "discharge_summary",
    entity_id: summaryId,
    before_json: null,
    after_json: {
      primaryDiagnosis: parsed.primaryDiagnosis,
      hospitalCourse: parsed.hospitalCourse,
      plan: parsed.plan,
      homeMedication: parsed.homeMedication,
    },
  });

  ensureNoError(
    await supabase
      .from("patients")
      .update({
        lifecycle: "discharged",
        discharged_at: dischargeDate,
        updated_by_id: session.profile.id,
      })
      .eq("id", patient.id),
    "Failed to discharge patient",
  );

  await insertActivityLog(supabase, {
    patient_id: patient.id,
    actor_id: session.profile.id,
    actor_name: session.profile.name,
    action: "patient.discharged",
    entity_type: "patient",
    entity_id: patient.id,
    before_json: patient,
    after_json: {
      ...patient,
      lifecycle: "discharged",
      discharged_at: dischargeDate,
    },
  });

  revalidateWardflowPaths(patient.id);
  return summaryId;
}

export async function saveProblem(formData: FormData, session: SessionContext) {
  requireClinicalEditor(session);
  const parsed = problemSchema.parse({
    id: textOrNull(formData.get("id")) ?? undefined,
    patientId: formData.get("patientId"),
    title: formData.get("title"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    currentStatus: textOrNull(formData.get("currentStatus")),
    evidence: textOrNull(formData.get("evidence")),
    treatment: textOrNull(formData.get("treatment")),
    reasoning: textOrNull(formData.get("reasoning")),
    todayPlan: textOrNull(formData.get("todayPlan")),
    keyData: textOrNull(formData.get("keyData")),
    plan: textOrNull(formData.get("plan")),
    pending: textOrNull(formData.get("pending")),
    watchOut: textOrNull(formData.get("watchOut")),
    includeInHandover: formData.get("includeInHandover") === "on",
    updatedAt: textOrNull(formData.get("updatedAt")),
  });
  const derivedKeyData = parsed.keyData ?? summaryLine(parsed.currentStatus, parsed.evidence);
  const derivedPlan = parsed.plan ?? parsed.todayPlan;

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const patient = patientById(store, parsed.patientId);
    if (!patient) throw new Error("Patient not found");
    requireWardWriteAccess(session, patient.wardId);

    if (parsed.id) {
      const existing = store.problems.find((entry) => entry.id === parsed.id);
      if (!existing) throw new Error("Problem not found");
      assertNoConflict(parsed.updatedAt, existing.updatedAt, "problem");

      const before = structuredClone(existing);
      existing.title = parsed.title;
      existing.status = parsed.status;
      existing.priority = parsed.priority;
      existing.currentStatus = parsed.currentStatus ?? null;
      existing.evidence = parsed.evidence ?? null;
      existing.treatment = parsed.treatment ?? null;
      existing.reasoning = parsed.reasoning ?? null;
      existing.todayPlan = parsed.todayPlan ?? null;
      existing.keyData = derivedKeyData ?? null;
      existing.plan = derivedPlan ?? null;
      existing.pending = parsed.pending ?? null;
      existing.watchOut = parsed.watchOut ?? null;
      existing.includeInHandover = parsed.includeInHandover;
      existing.updatedAt = now();
      addActivityToDemoStore(
        session,
        parsed.patientId,
        "problem.updated",
        "problem",
        existing.id,
        before,
        existing,
      );
    } else {
      const problem: Problem = {
        id: nextId("problem"),
        patientId: parsed.patientId,
        title: parsed.title,
        status: parsed.status,
        priority: parsed.priority,
        currentStatus: parsed.currentStatus ?? null,
        evidence: parsed.evidence ?? null,
        treatment: parsed.treatment ?? null,
        reasoning: parsed.reasoning ?? null,
        todayPlan: parsed.todayPlan ?? null,
        keyData: derivedKeyData ?? null,
        plan: derivedPlan ?? null,
        pending: parsed.pending ?? null,
        watchOut: parsed.watchOut ?? null,
        includeInHandover: parsed.includeInHandover,
        sortOrder:
          store.problems
            .filter((entry) => entry.patientId === parsed.patientId)
            .reduce((max, entry) => Math.max(max, entry.sortOrder), 0) + 1,
        updatedAt: now(),
      };
      store.problems.push(problem);
      addActivityToDemoStore(
        session,
        parsed.patientId,
        "problem.created",
        "problem",
        problem.id,
        null,
        problem,
      );
    }

    refreshDemoPatient(parsed.patientId);
    await persistDemoStore();
    revalidateWardflowPaths(parsed.patientId);
    return;
  }

  const supabase = await getLiveClient();
  const patient = await fetchLivePatient(supabase, parsed.patientId);
  if (!patient) throw new Error("Patient not found");
  requireWardWriteAccess(session, patient.ward_id);

  if (parsed.id) {
    const existing = await fetchLiveProblem(supabase, parsed.id);
    if (!existing) throw new Error("Problem not found");
    assertNoConflict(parsed.updatedAt, existing.updated_at, "problem");

    const fullUpdatePayload = {
      title: parsed.title,
      status: parsed.status,
      priority: parsed.priority,
      current_status: parsed.currentStatus ?? null,
      evidence: parsed.evidence ?? null,
      treatment: parsed.treatment ?? null,
      reasoning: parsed.reasoning ?? null,
      today_plan: parsed.todayPlan ?? null,
      key_data: derivedKeyData ?? null,
      plan: derivedPlan ?? null,
      pending: parsed.pending ?? null,
      watch_out: parsed.watchOut ?? null,
      include_in_handover: parsed.includeInHandover,
      updated_by_id: session.profile.id,
    };
    const legacyUpdatePayload = {
      title: parsed.title,
      status: parsed.status,
      key_data: derivedKeyData ?? null,
      plan: derivedPlan ?? null,
      pending: parsed.pending ?? null,
      watch_out: parsed.watchOut ?? null,
      include_in_handover: parsed.includeInHandover,
      updated_by_id: session.profile.id,
    };
    const updateResult = await supabase.from("problems").update(fullUpdatePayload).eq("id", parsed.id);
    if (updateResult.error && isRecoverableProblemSchemaError(updateResult.error)) {
      ensureNoError(
        await supabase.from("problems").update(legacyUpdatePayload).eq("id", parsed.id),
        "Failed to update problem",
      );
    } else {
      ensureNoError(updateResult, "Failed to update problem");
    }

    await insertActivityLog(supabase, {
      patient_id: parsed.patientId,
      actor_id: session.profile.id,
      actor_name: session.profile.name,
      action: "problem.updated",
      entity_type: "problem",
      entity_id: parsed.id,
      before_json: existing,
      after_json: {
        ...existing,
        title: parsed.title,
        status: parsed.status,
        priority: parsed.priority,
        current_status: parsed.currentStatus ?? null,
        evidence: parsed.evidence ?? null,
        treatment: parsed.treatment ?? null,
        reasoning: parsed.reasoning ?? null,
        today_plan: parsed.todayPlan ?? null,
        key_data: derivedKeyData ?? null,
        plan: derivedPlan ?? null,
        pending: parsed.pending ?? null,
        watch_out: parsed.watchOut ?? null,
        include_in_handover: parsed.includeInHandover,
      },
    });
  } else {
    const sortOrderResult = await supabase
      .from("problems")
      .select("sort_order")
      .eq("patient_id", parsed.patientId)
      .order("sort_order", { ascending: false })
      .limit(1);
    ensureNoError(sortOrderResult, "Failed to load problem order");

    const problemId = nextId("problem");
    const sortOrder = ((sortOrderResult.data?.[0] as { sort_order?: number } | undefined)?.sort_order ?? 0) + 1;
    const fullInsertPayload = {
      id: problemId,
      patient_id: parsed.patientId,
      title: parsed.title,
      status: parsed.status,
      priority: parsed.priority,
      current_status: parsed.currentStatus ?? null,
      evidence: parsed.evidence ?? null,
      treatment: parsed.treatment ?? null,
      reasoning: parsed.reasoning ?? null,
      today_plan: parsed.todayPlan ?? null,
      key_data: derivedKeyData ?? null,
      plan: derivedPlan ?? null,
      pending: parsed.pending ?? null,
      watch_out: parsed.watchOut ?? null,
      include_in_handover: parsed.includeInHandover,
      sort_order: sortOrder,
      updated_by_id: session.profile.id,
    };
    const legacyInsertPayload = {
      id: problemId,
      patient_id: parsed.patientId,
      title: parsed.title,
      status: parsed.status,
      key_data: derivedKeyData ?? null,
      plan: derivedPlan ?? null,
      pending: parsed.pending ?? null,
      watch_out: parsed.watchOut ?? null,
      include_in_handover: parsed.includeInHandover,
      sort_order: sortOrder,
      updated_by_id: session.profile.id,
    };
    const insertResult = await supabase.from("problems").insert(fullInsertPayload);
    if (insertResult.error && isRecoverableProblemSchemaError(insertResult.error)) {
      ensureNoError(
        await supabase.from("problems").insert(legacyInsertPayload),
        "Failed to create problem",
      );
    } else {
      ensureNoError(insertResult, "Failed to create problem");
    }

    await insertActivityLog(supabase, {
      patient_id: parsed.patientId,
      actor_id: session.profile.id,
      actor_name: session.profile.name,
      action: "problem.created",
      entity_type: "problem",
      entity_id: problemId,
      before_json: null,
      after_json: {
        title: parsed.title,
        status: parsed.status,
        priority: parsed.priority,
        sort_order: sortOrder,
      },
    });
  }

  ensureNoError(
    await supabase.from("patients").update({ updated_by_id: session.profile.id }).eq("id", parsed.patientId),
    "Failed to refresh patient timestamp",
  );
  revalidateWardflowPaths(parsed.patientId);
}

export async function moveProblem(
  patientId: string,
  problemId: string,
  direction: "up" | "down",
  session: SessionContext,
) {
  requireClinicalEditor(session);
  const bundle = await getPatientBundle(session, patientId);
  if (!bundle) return;

  const currentIndex = bundle.problems.findIndex((problem) => problem.id === problemId);
  const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || swapIndex < 0 || swapIndex >= bundle.problems.length) return;

  const current = bundle.problems[currentIndex];
  const swap = bundle.problems[swapIndex];

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const currentProblem = store.problems.find((problem) => problem.id === current.id);
    const swapProblem = store.problems.find((problem) => problem.id === swap.id);
    if (!currentProblem || !swapProblem) return;

    const fromOrder = currentProblem.sortOrder;
    const toOrder = swapProblem.sortOrder;
    [currentProblem.sortOrder, swapProblem.sortOrder] = [swapProblem.sortOrder, currentProblem.sortOrder];
    currentProblem.updatedAt = now();
    swapProblem.updatedAt = now();
    addActivityToDemoStore(
      session,
      patientId,
      "problem.reordered",
      "problem",
      problemId,
      { from: fromOrder, to: toOrder },
      { from: toOrder, to: fromOrder },
    );
    refreshDemoPatient(patientId);
    await persistDemoStore();
    revalidateWardflowPaths(patientId);
    return;
  }

  const supabase = await getLiveClient();
  ensureNoError(
    await supabase.from("problems").update({ sort_order: swap.sortOrder, updated_by_id: session.profile.id }).eq("id", current.id),
    "Failed to move problem",
  );
  ensureNoError(
    await supabase.from("problems").update({ sort_order: current.sortOrder, updated_by_id: session.profile.id }).eq("id", swap.id),
    "Failed to move problem",
  );
  await insertActivityLog(supabase, {
    patient_id: patientId,
    actor_id: session.profile.id,
    actor_name: session.profile.name,
    action: "problem.reordered",
    entity_type: "problem",
    entity_id: problemId,
    before_json: { from: current.sortOrder, to: swap.sortOrder },
    after_json: { from: swap.sortOrder, to: current.sortOrder },
  });
  ensureNoError(
    await supabase.from("patients").update({ updated_by_id: session.profile.id }).eq("id", patientId),
    "Failed to refresh patient timestamp",
  );
  revalidateWardflowPaths(patientId);
}

function resolveAssignableOwnerFromProfiles(
  profiles: UserProfile[],
  ownerId: string | null | undefined,
) {
  if (!ownerId) {
    return null;
  }

  const owner = profiles.find((profile) => profile.id === ownerId);
  if (!owner) {
    throw new Error("Selected owner is not allowed for this ward");
  }

  return owner;
}

async function getLiveAssignableProfilesForWard(supabase: LiveClient, wardId: string) {
  const result = await supabase
    .from("profiles")
    .select("id, name, email, avatar_url, role, ward_assignment")
    .or(`role.eq.admin,role.eq.resident,ward_assignment.eq.${wardId}`)
    .order("name", { ascending: true });
  ensureNoError(result, "Failed to load assignable profiles");
  return ((result.data ?? []) as ProfileRow[]).map(mapProfileRow);
}

export async function saveTask(formData: FormData, session: SessionContext) {
  requireClinicalEditor(session);
  const parsed = taskSchema.parse({
    id: textOrNull(formData.get("id")) ?? undefined,
    patientId: formData.get("patientId"),
    problemId: textOrNull(formData.get("problemId")),
    title: formData.get("title"),
    ownerId: textOrNull(formData.get("ownerId")),
    status: formData.get("status"),
    priority: formData.get("priority"),
    type: formData.get("type"),
    note: textOrNull(formData.get("note")),
    dueAt: textOrNull(formData.get("dueAt")),
    blockedReason: textOrNull(formData.get("blockedReason")),
    updatedAt: textOrNull(formData.get("updatedAt")),
  });

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const patient = patientById(store, parsed.patientId);
    if (!patient) throw new Error("Patient not found");
    requireTaskWorkflowWriteAccess(session, patient.wardId);
    if (
      parsed.problemId &&
      !store.problems.some(
        (problem) => problem.id === parsed.problemId && problem.patientId === parsed.patientId,
      )
    ) {
      throw new Error("Selected problem is not linked to this patient");
    }

    const owner = resolveAssignableOwnerFromProfiles(
      getProfilesForWard(store, patient.wardId),
      parsed.ownerId,
    );

    if (parsed.id) {
      const existing = store.tasks.find((entry) => entry.id === parsed.id);
      if (!existing) throw new Error("Task not found");
      assertNoConflict(parsed.updatedAt, existing.updatedAt, "task");

      const before = structuredClone(existing);
      existing.problemId = parsed.problemId ?? null;
      existing.title = parsed.title;
      existing.note = parsed.note ?? null;
      existing.ownerId = parsed.ownerId ?? null;
      existing.ownerName = owner?.name ?? null;
      existing.status = parsed.status;
      existing.priority = parsed.priority;
      existing.type = parsed.type;
      existing.dueAt = parsed.dueAt ?? null;
      existing.blockedReason = parsed.blockedReason ?? null;
      existing.updatedById = session.profile.id;
      existing.updatedByName = session.profile.name;
      existing.updatedAt = now();
      addActivityToDemoStore(
        session,
        parsed.patientId,
        "task.updated",
        "ward_task",
        existing.id,
        before,
        existing,
      );
    } else {
      const task: WardTask = {
        id: nextId("task"),
        patientId: parsed.patientId,
        problemId: parsed.problemId ?? null,
        title: parsed.title,
        note: parsed.note ?? null,
        ownerId: parsed.ownerId ?? null,
        ownerName: owner?.name ?? null,
        status: parsed.status,
        priority: parsed.priority,
        type: parsed.type,
        dueAt: parsed.dueAt ?? null,
        blockedReason: parsed.blockedReason ?? null,
        updatedById: session.profile.id,
        updatedByName: session.profile.name,
        updatedAt: now(),
      };
      store.tasks.unshift(task);
      addActivityToDemoStore(session, parsed.patientId, "task.created", "ward_task", task.id, null, task);
    }

    refreshDemoPatient(parsed.patientId);
    await persistDemoStore();
    revalidateWardflowPaths(parsed.patientId);
    return;
  }

  const supabase = await getLiveClient();
  const patient = await fetchLivePatient(supabase, parsed.patientId);
  if (!patient) throw new Error("Patient not found");
  requireTaskWorkflowWriteAccess(session, patient.ward_id);
  if (parsed.problemId) {
    const linkedProblem = await fetchLiveProblem(supabase, parsed.problemId);
    if (!linkedProblem || linkedProblem.patient_id !== parsed.patientId) {
      throw new Error("Selected problem is not linked to this patient");
    }
  }
  const owner = resolveAssignableOwnerFromProfiles(
    await getLiveAssignableProfilesForWard(supabase, patient.ward_id ?? ""),
    parsed.ownerId,
  );

  if (parsed.id) {
    const existing = await fetchLiveTask(supabase, parsed.id);
    if (!existing) throw new Error("Task not found");
    assertNoConflict(parsed.updatedAt, existing.updated_at, "task");

    const fullTaskUpdatePayload = {
      problem_id: parsed.problemId ?? null,
      title: parsed.title,
      note: parsed.note ?? null,
      owner_id: owner?.id ?? null,
      status: parsed.status,
      priority: parsed.priority,
      type: parsed.type,
      due_at: parsed.dueAt ?? null,
      blocked_reason: parsed.blockedReason ?? null,
      updated_by_id: session.profile.id,
    };
    const legacyTaskUpdatePayload = {
      title: parsed.title,
      note: parsed.note ?? null,
      owner_id: owner?.id ?? null,
      status: parsed.status,
      priority: parsed.priority,
      type: parsed.type,
      due_at: parsed.dueAt ?? null,
      blocked_reason: parsed.blockedReason ?? null,
      updated_by_id: session.profile.id,
    };
    const updateResult = await supabase
      .from("ward_tasks")
      .update(fullTaskUpdatePayload)
      .eq("id", parsed.id);
    if (updateResult.error && isRecoverableTaskProblemLinkError(updateResult.error)) {
      ensureNoError(
        await supabase.from("ward_tasks").update(legacyTaskUpdatePayload).eq("id", parsed.id),
        "Failed to update task",
      );
    } else {
      ensureNoError(updateResult, "Failed to update task");
    }

    await insertActivityLog(supabase, {
      patient_id: parsed.patientId,
      actor_id: session.profile.id,
      actor_name: session.profile.name,
      action: "task.updated",
      entity_type: "ward_task",
      entity_id: parsed.id,
      before_json: existing,
      after_json: {
        ...existing,
        problem_id: parsed.problemId ?? null,
        title: parsed.title,
        note: parsed.note ?? null,
        owner_id: owner?.id ?? null,
        status: parsed.status,
        priority: parsed.priority,
        type: parsed.type,
        due_at: parsed.dueAt ?? null,
        blocked_reason: parsed.blockedReason ?? null,
      },
    });
  } else {
    const taskId = nextId("task");
    const fullTaskInsertPayload = {
      id: taskId,
      patient_id: parsed.patientId,
      problem_id: parsed.problemId ?? null,
      title: parsed.title,
      note: parsed.note ?? null,
      owner_id: owner?.id ?? null,
      status: parsed.status,
      priority: parsed.priority,
      type: parsed.type,
      due_at: parsed.dueAt ?? null,
      blocked_reason: parsed.blockedReason ?? null,
      updated_by_id: session.profile.id,
    };
    const legacyTaskInsertPayload = {
      id: taskId,
      patient_id: parsed.patientId,
      title: parsed.title,
      note: parsed.note ?? null,
      owner_id: owner?.id ?? null,
      status: parsed.status,
      priority: parsed.priority,
      type: parsed.type,
      due_at: parsed.dueAt ?? null,
      blocked_reason: parsed.blockedReason ?? null,
      updated_by_id: session.profile.id,
    };
    const insertResult = await supabase.from("ward_tasks").insert(fullTaskInsertPayload);
    if (insertResult.error && isRecoverableTaskProblemLinkError(insertResult.error)) {
      ensureNoError(
        await supabase.from("ward_tasks").insert(legacyTaskInsertPayload),
        "Failed to create task",
      );
    } else {
      ensureNoError(insertResult, "Failed to create task");
    }

    await insertActivityLog(supabase, {
      patient_id: parsed.patientId,
      actor_id: session.profile.id,
      actor_name: session.profile.name,
      action: "task.created",
      entity_type: "ward_task",
      entity_id: taskId,
      before_json: null,
      after_json: {
        title: parsed.title,
        problem_id: parsed.problemId ?? null,
        status: parsed.status,
        priority: parsed.priority,
      },
    });
  }

  ensureNoError(
    await supabase.from("patients").update({ updated_by_id: session.profile.id }).eq("id", parsed.patientId),
    "Failed to refresh patient timestamp",
  );
  revalidateWardflowPaths(parsed.patientId);
}

export async function updateTaskStatus(
  patientId: string,
  taskId: string,
  status: WardTask["status"],
  expectedUpdatedAt: string | null,
  session: SessionContext,
) {
  requireClinicalEditor(session);

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const patient = patientById(store, patientId);
    if (!patient) throw new Error("Patient not found");
    requireTaskWorkflowWriteAccess(session, patient.wardId);
    const task = store.tasks.find((entry) => entry.id === taskId);
    if (!task) throw new Error("Task not found");
    assertNoConflict(expectedUpdatedAt, task.updatedAt, "task");

    const before = { status: task.status };
    task.status = status;
    task.updatedAt = now();
    task.updatedById = session.profile.id;
    task.updatedByName = session.profile.name;
    addActivityToDemoStore(session, patientId, "task.status_changed", "ward_task", task.id, before, {
      status,
    });
    refreshDemoPatient(patientId);
    await persistDemoStore();
    revalidateWardflowPaths(patientId);
    return;
  }

  const supabase = await getLiveClient();
  const patient = await fetchLivePatient(supabase, patientId);
  if (!patient) throw new Error("Patient not found");
  requireTaskWorkflowWriteAccess(session, patient.ward_id);

  const task = await fetchLiveTask(supabase, taskId);
  if (!task) throw new Error("Task not found");
  assertNoConflict(expectedUpdatedAt, task.updated_at, "task");

  ensureNoError(
    await supabase
      .from("ward_tasks")
      .update({
        status,
        updated_by_id: session.profile.id,
      })
      .eq("id", taskId),
    "Failed to update task status",
  );

  await insertActivityLog(supabase, {
    patient_id: patientId,
    actor_id: session.profile.id,
    actor_name: session.profile.name,
    action: "task.status_changed",
    entity_type: "ward_task",
    entity_id: taskId,
    before_json: { status: task.status },
    after_json: { status },
  });
  ensureNoError(
    await supabase.from("patients").update({ updated_by_id: session.profile.id }).eq("id", patientId),
    "Failed to refresh patient timestamp",
  );
  revalidateWardflowPaths(patientId);
}

export async function saveTaskUpdate(formData: FormData, session: SessionContext) {
  requireClinicalEditor(session);
  const parsed = taskUpdateSchema.parse({
    taskId: formData.get("taskId"),
    note: formData.get("note"),
  });

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const task = store.tasks.find((entry) => entry.id === parsed.taskId);
    if (!task) throw new Error("Task not found");
    const patient = patientById(store, task.patientId);
    if (!patient) throw new Error("Patient not found");
    requireTaskWorkflowWriteAccess(session, patient.wardId);

    store.taskUpdates.unshift({
      id: nextId("task-update"),
      taskId: task.id,
      note: parsed.note,
      createdById: session.profile.id,
      createdByName: session.profile.name,
      createdAt: now(),
    });
    task.updatedById = session.profile.id;
    task.updatedByName = session.profile.name;
    task.updatedAt = now();
    refreshDemoPatient(patient.id);
    await persistDemoStore();
    revalidateWardflowPaths(patient.id);
    return;
  }

  const supabase = await getLiveClient();
  const task = await fetchLiveTask(supabase, parsed.taskId);
  if (!task) throw new Error("Task not found");
  const patient = await fetchLivePatient(supabase, task.patient_id);
  if (!patient) throw new Error("Patient not found");
  requireTaskWorkflowWriteAccess(session, patient.ward_id);

  ensureNoError(
    await supabase.from("task_updates").insert({
      id: nextId("task-update"),
      task_id: task.id,
      note: parsed.note,
      created_by_id: session.profile.id,
      created_by_name: session.profile.name,
    }),
    "Failed to create task update",
  );
  ensureNoError(
    await supabase
      .from("ward_tasks")
      .update({ updated_by_id: session.profile.id })
      .eq("id", task.id),
    "Failed to refresh task timestamp",
  );
  ensureNoError(
    await supabase.from("patients").update({ updated_by_id: session.profile.id }).eq("id", patient.id),
    "Failed to refresh patient timestamp",
  );
  revalidateWardflowPaths(patient.id);
}

export async function bulkCreateTasks(formData: FormData, session: SessionContext) {
  requireClinicalEditor(session);
  const rawPayload = formData.get("payload");
  if (typeof rawPayload !== "string") {
    throw new Error("Bulk task payload is missing");
  }

  let payload: BulkTaskPayload;
  try {
    payload = bulkTaskPayloadSchema.parse(JSON.parse(rawPayload)) as BulkTaskPayload;
  } catch {
    throw new Error("Bulk task payload is invalid");
  }

  const rawRows = payload.rows.map((row) => ({
    patientId: row.patientId.trim(),
    title: row.title.trim(),
    ownerId: row.ownerId?.trim() ? row.ownerId.trim() : null,
    priority: row.priority,
    type: row.type,
    note: row.note?.trim() ? row.note.trim() : null,
  }));

  const validRows = rawRows.filter((row) => row.patientId || row.title || row.ownerId || row.note);
  if (!validRows.length) {
    throw new Error("No valid task rows to create");
  }

  for (const row of validRows) {
    if (!row.patientId || !row.title) {
      throw new Error("Each non-empty task row must include patient and title");
    }
  }

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const createdPatientIds = new Set<string>();

    for (const row of validRows) {
      const patient = patientById(store, row.patientId);
      if (!patient || patient.lifecycle !== "active") {
        throw new Error("Bulk task row references an invalid active patient");
      }
      requireTaskWorkflowWriteAccess(session, patient.wardId);
      const owner = resolveAssignableOwnerFromProfiles(
        getProfilesForWard(store, patient.wardId),
        row.ownerId,
      );

      const task: WardTask = {
        id: nextId("task"),
        patientId: patient.id,
        problemId: null,
        title: row.title,
        note: row.note,
        ownerId: owner?.id ?? null,
        ownerName: owner?.name ?? null,
        status: "not_started",
        priority: row.priority,
        type: row.type,
        dueAt: null,
        blockedReason: null,
        updatedById: session.profile.id,
        updatedByName: session.profile.name,
        updatedAt: now(),
      };

      store.tasks.unshift(task);
      addActivityToDemoStore(session, patient.id, "task.created", "ward_task", task.id, null, task);
      refreshDemoPatient(patient.id);
      createdPatientIds.add(patient.id);
    }

    await persistDemoStore();
    for (const patientId of createdPatientIds) {
      revalidateWardflowPaths(patientId);
    }
    for (const wardId of [...new Set(validRows.map((row) => patientById(store, row.patientId)?.wardId ?? ""))]) {
      if (wardId) {
        revalidatePath(`/tasks/quick/${wardId}`);
      }
    }
    return validRows.length;
  }

  const supabase = await getLiveClient();
  const patientIds = [...new Set(validRows.map((row) => row.patientId))];
  const patientsResult = await supabase
    .from("patients")
    .select("*")
    .in("id", patientIds);
  ensureNoError(patientsResult, "Failed to load patients for bulk create");
  const patients = new Map(
    ((patientsResult.data ?? []) as PatientRow[]).map((patient) => [patient.id, patient]),
  );

  const profilesByWard = new Map<string, UserProfile[]>();
  for (const wardId of [...new Set(validRows.map((row) => patients.get(row.patientId)?.ward_id ?? ""))]) {
    if (!wardId) continue;
    profilesByWard.set(wardId, await getLiveAssignableProfilesForWard(supabase, wardId));
  }

  const inserts: Array<Record<string, unknown>> = [];
  const activityEntries: ActivityInsert[] = [];

  for (const row of validRows) {
    const patient = patients.get(row.patientId);
    if (!patient || patient.lifecycle !== "active") {
      throw new Error("Bulk task row references an invalid active patient");
    }
    requireTaskWorkflowWriteAccess(session, patient.ward_id);
    const owner = resolveAssignableOwnerFromProfiles(
      profilesByWard.get(patient.ward_id ?? "") ?? [],
      row.ownerId,
    );
    const taskId = nextId("task");

    inserts.push({
      id: taskId,
      patient_id: patient.id,
      problem_id: null,
      title: row.title,
      note: row.note,
      owner_id: owner?.id ?? null,
      status: "not_started",
      priority: row.priority,
      type: row.type,
      due_at: null,
      blocked_reason: null,
      updated_by_id: session.profile.id,
    });
    activityEntries.push({
      patient_id: patient.id,
      actor_id: session.profile.id,
      actor_name: session.profile.name,
      action: "task.created",
      entity_type: "ward_task",
      entity_id: taskId,
      before_json: null,
      after_json: {
        title: row.title,
        status: "not_started",
        priority: row.priority,
      },
    });
  }

  ensureNoError(await supabase.from("ward_tasks").insert(inserts), "Failed to bulk create tasks");
  for (const entry of activityEntries) {
    await insertActivityLog(supabase, entry);
  }
  ensureNoError(
    await supabase.from("patients").update({ updated_by_id: session.profile.id }).in("id", patientIds),
    "Failed to refresh patient timestamps",
  );
  for (const patientId of patientIds) {
    revalidateWardflowPaths(patientId);
  }
  for (const wardId of [...new Set(validRows.map((row) => patients.get(row.patientId)?.ward_id ?? ""))]) {
    if (wardId) {
      revalidatePath(`/tasks/quick/${wardId}`);
    }
  }
  return validRows.length;
}

export async function saveHandover(formData: FormData, session: SessionContext) {
  requireClinicalEditor(session);
  const parsed = handoverSchema.parse({
    patientId: formData.get("patientId"),
    note: textOrNull(formData.get("note")) ?? "",
    escalationInstruction: textOrNull(formData.get("escalationInstruction")),
    updatedAt: textOrNull(formData.get("updatedAt")),
  });

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    const patient = patientById(store, parsed.patientId);
    if (!patient) throw new Error("Patient not found");
    requireWardWriteAccess(session, patient.wardId);

    const existing = store.handovers.find((handover) => handover.patientId === parsed.patientId);
    if (existing) {
      assertNoConflict(parsed.updatedAt, existing.updatedAt, "handover");
      const before = structuredClone(existing);
      existing.note = parsed.note;
      existing.escalationInstruction = parsed.escalationInstruction ?? null;
      existing.updatedAt = now();
      addActivityToDemoStore(
        session,
        parsed.patientId,
        "handover.updated",
        "handover_note",
        existing.id,
        before,
        existing,
      );
    } else {
      const handover: HandoverNote = {
        id: nextId("handover"),
        patientId: parsed.patientId,
        note: parsed.note,
        escalationInstruction: parsed.escalationInstruction ?? null,
        updatedAt: now(),
      };
      store.handovers.push(handover);
      addActivityToDemoStore(
        session,
        parsed.patientId,
        "handover.updated",
        "handover_note",
        handover.id,
        null,
        handover,
      );
    }

    refreshDemoPatient(parsed.patientId);
    await persistDemoStore();
    revalidateWardflowPaths(parsed.patientId);
    return;
  }

  const supabase = await getLiveClient();
  const patient = await fetchLivePatient(supabase, parsed.patientId);
  if (!patient) throw new Error("Patient not found");
  requireWardWriteAccess(session, patient.ward_id);

  const existing = await fetchLiveHandover(supabase, parsed.patientId);
  if (existing) {
    assertNoConflict(parsed.updatedAt, existing.updated_at, "handover");
    ensureNoError(
      await supabase
        .from("handover_notes")
        .update({
          note: parsed.note,
          escalation_instruction: parsed.escalationInstruction ?? null,
          updated_by_id: session.profile.id,
        })
        .eq("id", existing.id),
      "Failed to update handover",
    );

    await insertActivityLog(supabase, {
      patient_id: parsed.patientId,
      actor_id: session.profile.id,
      actor_name: session.profile.name,
      action: "handover.updated",
      entity_type: "handover_note",
      entity_id: existing.id,
      before_json: existing,
      after_json: {
        ...existing,
        note: parsed.note,
        escalation_instruction: parsed.escalationInstruction ?? null,
      },
    });
  } else {
    const handoverId = nextId("handover");
    ensureNoError(
      await supabase.from("handover_notes").insert({
        id: handoverId,
        patient_id: parsed.patientId,
        note: parsed.note,
        escalation_instruction: parsed.escalationInstruction ?? null,
        updated_by_id: session.profile.id,
      }),
      "Failed to create handover",
    );

    await insertActivityLog(supabase, {
      patient_id: parsed.patientId,
      actor_id: session.profile.id,
      actor_name: session.profile.name,
      action: "handover.updated",
      entity_type: "handover_note",
      entity_id: handoverId,
      before_json: null,
      after_json: {
        note: parsed.note,
        escalation_instruction: parsed.escalationInstruction ?? null,
      },
    });
  }

  ensureNoError(
    await supabase.from("patients").update({ updated_by_id: session.profile.id }).eq("id", parsed.patientId),
    "Failed to refresh patient timestamp",
  );
  revalidateWardflowPaths(parsed.patientId);
}

export async function saveTemplate(formData: FormData, session: SessionContext) {
  if (!canManageAdmin(session)) {
    throw new Error("Admin only");
  }

  const parsed = templateSchema.parse({
    title: formData.get("title"),
    type: formData.get("type"),
    defaultPriority: formData.get("defaultPriority"),
  });

  if (session.mode === "demo" || !hasLiveSupabase()) {
    await ensureDemoStoreLoaded();
    store.templates.push({
      id: nextId("template"),
      title: parsed.title,
      type: parsed.type,
      defaultPriority: parsed.defaultPriority,
    });
    await persistDemoStore();
    revalidateWardflowPaths();
    return;
  }

  const supabase = await getLiveClient();
  ensureNoError(
    await supabase.from("task_templates").insert({
      id: nextId("template"),
      title: parsed.title,
      type: parsed.type,
      default_priority: parsed.defaultPriority,
    }),
    "Failed to create task template",
  );
  revalidateWardflowPaths();
}
