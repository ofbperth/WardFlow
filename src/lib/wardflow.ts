import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  demoActivitySeed,
  demoHandoverSeed,
  demoPatientsSeed,
  demoProblemsSeed,
  demoProfiles,
  demoTasksSeed,
  demoTemplatesSeed,
  demoWards,
} from "@/lib/demo-data";
import type {
  ActivityLog,
  HandoverBundle,
  HandoverNote,
  Patient,
  PatientBundle,
  Problem,
  SessionContext,
  TaskTemplate,
  UserProfile,
  Ward,
  WardSummary,
  WardTask,
} from "@/lib/types";

type DemoStore = {
  wards: Ward[];
  patients: Patient[];
  problems: Problem[];
  tasks: WardTask[];
  handovers: HandoverNote[];
  activity: ActivityLog[];
  templates: TaskTemplate[];
  profiles: UserProfile[];
};

const store: DemoStore = {
  wards: structuredClone(demoWards),
  patients: structuredClone(demoPatientsSeed),
  problems: structuredClone(demoProblemsSeed),
  tasks: structuredClone(demoTasksSeed),
  handovers: structuredClone(demoHandoverSeed),
  activity: structuredClone(demoActivitySeed),
  templates: structuredClone(demoTemplatesSeed),
  profiles: structuredClone(demoProfiles),
};

const patientSchema = z.object({
  wardId: z.string().min(1),
  bed: z.string().min(1),
  displayName: z.string().min(1),
  diagnosis: z.string().min(1),
  status: z.enum(["stable", "watch", "critical"]),
  responsibleDoctorId: z.string().optional().nullable(),
});

const problemSchema = z.object({
  patientId: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["active", "improving", "worsening", "resolved"]),
  keyData: z.string().optional().nullable(),
  plan: z.string().optional().nullable(),
  pending: z.string().optional().nullable(),
  watchOut: z.string().optional().nullable(),
  includeInHandover: z.coerce.boolean(),
});

const taskSchema = z.object({
  patientId: z.string().min(1),
  title: z.string().min(1),
  ownerId: z.string().optional().nullable(),
  status: z.enum(["not_started", "in_progress", "waiting", "done", "blocked"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
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
});

const handoverSchema = z.object({
  patientId: z.string().min(1),
  note: z.string().optional().default(""),
  escalationInstruction: z.string().optional().nullable(),
});

const wardSchema = z.object({
  name: z.string().min(1),
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
  defaultPriority: z.enum(["low", "normal", "high", "urgent"]),
});

function now() {
  return new Date().toISOString();
}

function nextId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function textOrNull(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function requireWardAccess(session: SessionContext, wardId: string) {
  if (session.profile.role === "admin") return;
  if (session.profile.wardAssignment !== wardId) {
    throw new Error("Ward access denied");
  }
}

function patientById(patientId: string) {
  return store.patients.find((patient) => patient.id === patientId) ?? null;
}

function addActivity(
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

function refreshPatient(patientId: string) {
  const patient = patientById(patientId);
  if (patient) {
    patient.lastUpdate = now();
  }
}

function visibleWardIds(session: SessionContext) {
  return session.profile.role === "admin"
    ? store.wards.map((ward) => ward.id)
    : [session.profile.wardAssignment].filter(Boolean) as string[];
}

export async function getWardSummaries(session: SessionContext): Promise<WardSummary[]> {
  const wardIds = visibleWardIds(session);

  return store.wards
    .filter((ward) => wardIds.includes(ward.id))
    .map((ward) => ({
      ward,
      patients: store.patients
        .filter((patient) => patient.wardId === ward.id)
        .map((patient) => {
          const tasks = store.tasks.filter((task) => task.patientId === patient.id);
          return {
            ...patient,
            pendingTaskCount: tasks.filter((task) => task.status !== "done").length,
            blockedTaskCount: tasks.filter((task) => task.status === "blocked").length,
          };
        }),
    }));
}

export async function getWardDetail(session: SessionContext, wardId: string) {
  requireWardAccess(session, wardId);
  const summaries = await getWardSummaries(session);
  return summaries.find((summary) => summary.ward.id === wardId) ?? null;
}

export async function getPatientBundle(session: SessionContext, patientId: string): Promise<PatientBundle | null> {
  const patient = patientById(patientId);
  if (!patient) return null;
  requireWardAccess(session, patient.wardId);

  return {
    patient,
    ward: store.wards.find((ward) => ward.id === patient.wardId) ?? null,
    problems: store.problems
      .filter((problem) => problem.patientId === patientId)
      .sort((left, right) => left.sortOrder - right.sortOrder),
    tasks: store.tasks
      .filter((task) => task.patientId === patientId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    handover: store.handovers.find((handover) => handover.patientId === patientId) ?? null,
    activity: store.activity
      .filter((activity) => activity.patientId === patientId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
}

export async function getProfiles(session: SessionContext) {
  return store.profiles.filter(
    (profile) =>
      session.profile.role === "admin" ||
      profile.wardAssignment === session.profile.wardAssignment ||
      profile.id === session.profile.id,
  );
}

export async function getTaskTemplates() {
  return [...store.templates].sort((left, right) => left.title.localeCompare(right.title));
}

export async function getMyTasks(session: SessionContext) {
  const patientMap = new Map(store.patients.map((patient) => [patient.id, patient]));
  return store.tasks
    .filter((task) => task.ownerId === session.profile.id || session.profile.role === "admin")
    .map((task) => ({ task, patient: patientMap.get(task.patientId)! }));
}

export async function getHandoverBundles(session: SessionContext): Promise<HandoverBundle[]> {
  const summaries = await getWardSummaries(session);
  return summaries.map((summary) => ({
    ward: summary.ward,
    patients: summary.patients
      .map((patient) => ({
        ...patient,
        problems: store.problems.filter(
          (problem) => problem.patientId === patient.id && problem.status !== "resolved",
        ),
        tasks: store.tasks.filter((task) => task.patientId === patient.id && task.status !== "done"),
        handover: store.handovers.find((handover) => handover.patientId === patient.id) ?? null,
      }))
      .sort((left, right) => {
        const weight = (status: Patient["status"]) =>
          status === "critical" ? 0 : status === "watch" ? 1 : 2;
        return weight(left.status) - weight(right.status);
      }),
  }));
}

export async function saveWard(formData: FormData, session: SessionContext) {
  if (session.profile.role !== "admin") {
    throw new Error("Admin only");
  }

  const parsed = wardSchema.parse({ name: formData.get("name") });
  store.wards.push({ id: nextId("ward"), name: parsed.name });
  revalidatePath("/wards");
  revalidatePath("/admin/wards");
}

export async function savePatient(formData: FormData, session: SessionContext) {
  const parsed = patientSchema.parse({
    wardId: formData.get("wardId"),
    bed: formData.get("bed"),
    displayName: formData.get("displayName"),
    diagnosis: formData.get("diagnosis"),
    status: formData.get("status"),
    responsibleDoctorId: textOrNull(formData.get("responsibleDoctorId")),
  });
  requireWardAccess(session, parsed.wardId);

  const owner = store.profiles.find((profile) => profile.id === parsed.responsibleDoctorId);
  const patient: Patient = {
    id: nextId("patient"),
    wardId: parsed.wardId,
    bed: parsed.bed,
    displayName: parsed.displayName,
    age: null,
    sex: null,
    diagnosis: parsed.diagnosis,
    status: parsed.status,
    responsibleDoctorId: parsed.responsibleDoctorId ?? session.profile.id,
    responsibleDoctorName: owner?.name ?? session.profile.name,
    allergy: null,
    isolationFlag: false,
    codeStatus: null,
    lastUpdate: now(),
  };

  store.patients.push(patient);
  addActivity(session, patient.id, "patient.created", "patient", patient.id, null, patient);
  revalidatePath("/wards");
}

export async function saveProblem(formData: FormData, session: SessionContext) {
  const parsed = problemSchema.parse({
    patientId: formData.get("patientId"),
    title: formData.get("title"),
    status: formData.get("status"),
    keyData: textOrNull(formData.get("keyData")),
    plan: textOrNull(formData.get("plan")),
    pending: textOrNull(formData.get("pending")),
    watchOut: textOrNull(formData.get("watchOut")),
    includeInHandover: formData.get("includeInHandover") === "on",
  });

  const patient = patientById(parsed.patientId);
  if (!patient) throw new Error("Patient not found");
  requireWardAccess(session, patient.wardId);

  const problem: Problem = {
    id: nextId("problem"),
    patientId: parsed.patientId,
    title: parsed.title,
    status: parsed.status,
    keyData: parsed.keyData ?? null,
    plan: parsed.plan ?? null,
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
  addActivity(session, parsed.patientId, "problem.created", "problem", problem.id, null, problem);
  refreshPatient(parsed.patientId);
  revalidatePath(`/patients/${parsed.patientId}`);
  revalidatePath("/handover");
}

export async function moveProblem(
  patientId: string,
  problemId: string,
  direction: "up" | "down",
  session: SessionContext,
) {
  const bundle = await getPatientBundle(session, patientId);
  if (!bundle) return;
  const currentIndex = bundle.problems.findIndex((problem) => problem.id === problemId);
  const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || swapIndex < 0 || swapIndex >= bundle.problems.length) return;

  const current = store.problems.find((problem) => problem.id === bundle.problems[currentIndex].id);
  const swap = store.problems.find((problem) => problem.id === bundle.problems[swapIndex].id);
  if (!current || !swap) return;

  [current.sortOrder, swap.sortOrder] = [swap.sortOrder, current.sortOrder];
  current.updatedAt = now();
  swap.updatedAt = now();
  addActivity(
    session,
    patientId,
    "problem.reordered",
    "problem",
    problemId,
    { from: current.sortOrder, to: swap.sortOrder },
    { from: swap.sortOrder, to: current.sortOrder },
  );
  refreshPatient(patientId);
  revalidatePath(`/patients/${patientId}`);
}

export async function saveTask(formData: FormData, session: SessionContext) {
  const parsed = taskSchema.parse({
    patientId: formData.get("patientId"),
    title: formData.get("title"),
    ownerId: textOrNull(formData.get("ownerId")),
    status: formData.get("status"),
    priority: formData.get("priority"),
    type: formData.get("type"),
    note: textOrNull(formData.get("note")),
    dueAt: textOrNull(formData.get("dueAt")),
    blockedReason: textOrNull(formData.get("blockedReason")),
  });

  const patient = patientById(parsed.patientId);
  if (!patient) throw new Error("Patient not found");
  requireWardAccess(session, patient.wardId);

  const owner = store.profiles.find((profile) => profile.id === parsed.ownerId);
  const task: WardTask = {
    id: nextId("task"),
    patientId: parsed.patientId,
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
  addActivity(session, parsed.patientId, "task.created", "ward_task", task.id, null, task);
  refreshPatient(parsed.patientId);
  revalidatePath(`/patients/${parsed.patientId}`);
  revalidatePath("/my-tasks");
  revalidatePath("/handover");
}

export async function updateTaskStatus(
  patientId: string,
  taskId: string,
  status: WardTask["status"],
  session: SessionContext,
) {
  const patient = patientById(patientId);
  if (!patient) throw new Error("Patient not found");
  requireWardAccess(session, patient.wardId);
  const task = store.tasks.find((entry) => entry.id === taskId);
  if (!task) throw new Error("Task not found");

  const before = { status: task.status };
  task.status = status;
  task.updatedAt = now();
  task.updatedById = session.profile.id;
  task.updatedByName = session.profile.name;
  addActivity(session, patientId, "task.status_changed", "ward_task", task.id, before, {
    status,
  });
  refreshPatient(patientId);
  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/my-tasks");
  revalidatePath("/handover");
}

export async function saveHandover(formData: FormData, session: SessionContext) {
  const parsed = handoverSchema.parse({
    patientId: formData.get("patientId"),
    note: textOrNull(formData.get("note")) ?? "",
    escalationInstruction: textOrNull(formData.get("escalationInstruction")),
  });

  const patient = patientById(parsed.patientId);
  if (!patient) throw new Error("Patient not found");
  requireWardAccess(session, patient.wardId);

  const existing = store.handovers.find((handover) => handover.patientId === parsed.patientId);
  if (existing) {
    const before = structuredClone(existing);
    existing.note = parsed.note;
    existing.escalationInstruction = parsed.escalationInstruction ?? null;
    existing.updatedAt = now();
    addActivity(
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
    addActivity(
      session,
      parsed.patientId,
      "handover.updated",
      "handover_note",
      handover.id,
      null,
      handover,
    );
  }

  refreshPatient(parsed.patientId);
  revalidatePath(`/patients/${parsed.patientId}`);
  revalidatePath("/handover");
}

export async function saveTemplate(formData: FormData, session: SessionContext) {
  if (session.profile.role !== "admin") {
    throw new Error("Admin only");
  }

  const parsed = templateSchema.parse({
    title: formData.get("title"),
    type: formData.get("type"),
    defaultPriority: formData.get("defaultPriority"),
  });

  store.templates.push({
    id: nextId("template"),
    title: parsed.title,
    type: parsed.type,
    defaultPriority: parsed.defaultPriority,
  });
  revalidatePath("/admin/task-templates");
}
