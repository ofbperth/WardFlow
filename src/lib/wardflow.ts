import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  demoActivitySeed,
  demoDischargeSummarySeed,
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
  DischargeSummary,
  DischargedDirectoryItem,
  HandoverBundle,
  HandoverNote,
  Patient,
  PatientBundle,
  Problem,
  Role,
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
  dischargeSummaries: DischargeSummary[];
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
  dischargeSummaries: structuredClone(demoDischargeSummarySeed),
  activity: structuredClone(demoActivitySeed),
  templates: structuredClone(demoTemplatesSeed),
  profiles: structuredClone(demoProfiles),
};

const patientSchema = z.object({
  id: z.string().optional(),
  wardId: z.string().min(1),
  bed: z.string().min(1),
  displayName: z.string().min(1),
  diagnosis: z.string().min(1),
  status: z.enum(["stable", "watch", "critical"]),
  responsibleDoctorId: z.string().optional().nullable(),
  precaution: z.enum(["none", "contact", "droplet", "airborne"]),
});

const problemSchema = z.object({
  id: z.string().optional(),
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
  id: z.string().optional(),
  patientId: z.string().min(1),
  title: z.string().min(1),
  ownerId: z.string().optional().nullable(),
  status: z.enum(["not_started", "in_progress", "done", "blocked"]),
  priority: z.enum(["normal", "urgency", "emergency"]),
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
  id: z.string().optional(),
  name: z.string().min(1),
});

const deleteWardSchema = z.object({
  wardId: z.string().min(1),
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
  defaultPriority: z.enum(["normal", "urgency", "emergency"]),
});

const userRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["admin", "resident", "student"]),
});

const dischargeSummarySchema = z.object({
  patientId: z.string().min(1),
  primaryDiagnosis: z.string().min(1),
  hospitalCourse: z.string().default(""),
  plan: z.string().default(""),
  homeMedication: z.string().default(""),
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

function buildWardSummary(session: SessionContext, lifecycle: "active" | "discharged"): WardSummary[] {
  const wardIds = visibleWardIds(session);

  return store.wards
    .filter((ward) => wardIds.includes(ward.id))
    .map((ward) => ({
      ward,
      patients: store.patients
        .filter((patient) => patient.wardId === ward.id && patient.lifecycle === lifecycle)
        .map((patient) => {
          const tasks = store.tasks.filter((task) => task.patientId === patient.id);
          return {
            ...patient,
            pendingTaskCount: tasks.filter((task) => task.status !== "done").length,
            blockedTaskCount: tasks.filter((task) => task.status === "blocked").length,
          };
        }),
    }))
    .filter((summary) => summary.patients.length > 0 || lifecycle === "active");
}

function getPatientDirectoryName(profileId: string | null, fallback: string | null = null) {
  return store.profiles.find((profile) => profile.id === profileId)?.name ?? fallback ?? null;
}

function summaryByPatientId(patientId: string) {
  return store.dischargeSummaries.find((summary) => summary.patientId === patientId) ?? null;
}

function getPatientAdmitDate(patientId: string) {
  const patientActivities = store.activity
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

function buildDischargeDraft(patientId: string) {
  const patient = patientById(patientId);
  if (!patient) return null;

  const hospitalCourseItems = store.problems
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

  const planItems = store.tasks
    .filter((task) => task.patientId === patientId && task.status !== "done")
    .map((task) =>
      [task.title, task.note, task.blockedReason ? `Blocked: ${task.blockedReason}` : null]
        .filter(Boolean)
        .join(" | "),
    );

  const admitDate = getPatientAdmitDate(patientId);
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

export async function getWardSummaries(session: SessionContext): Promise<WardSummary[]> {
  return buildWardSummary(session, "active");
}

export async function getDischargedSummaries(session: SessionContext): Promise<WardSummary[]> {
  return buildWardSummary(session, "discharged");
}

export async function getDischargedDirectory(
  session: SessionContext,
  options: { wardId?: string | null; query?: string | null; page?: number; pageSize?: number } = {},
) {
  const wardId = options.wardId?.trim() || null;
  const query = options.query?.trim().toLowerCase() || "";
  const pageSize = options.pageSize ?? 10;
  const page = Math.max(1, options.page ?? 1);
  const wardIds = visibleWardIds(session);

  const filtered = store.patients
    .filter((patient) => patient.lifecycle === "discharged" && wardIds.includes(patient.wardId))
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
    ward: store.wards.find((ward) => ward.id === patient.wardId) ?? null,
    summary: summaryByPatientId(patient.id),
  }));

  return {
    items,
    wards: store.wards.filter((ward) => wardIds.includes(ward.id)),
    total,
    page: Math.min(page, totalPages),
    totalPages,
    pageSize,
  };
}

export async function getDischargeSummaryById(session: SessionContext, summaryId: string) {
  const summary = store.dischargeSummaries.find((entry) => entry.id === summaryId) ?? null;
  if (!summary) return null;
  const patient = patientById(summary.patientId);
  if (!patient) return null;
  requireWardAccess(session, patient.wardId);

  return {
    summary,
    patient,
    ward: store.wards.find((ward) => ward.id === patient.wardId) ?? null,
  };
}

export async function getDischargeSummaryByPatientId(session: SessionContext, patientId: string) {
  const patient = patientById(patientId);
  if (!patient) return null;
  requireWardAccess(session, patient.wardId);

  const summary = summaryByPatientId(patientId);
  if (!summary) return null;

  return {
    summary,
    patient,
    ward: store.wards.find((ward) => ward.id === patient.wardId) ?? null,
  };
}

export async function getDischargeDraft(session: SessionContext, patientId: string) {
  const patient = patientById(patientId);
  if (!patient) return null;
  requireWardAccess(session, patient.wardId);
  return buildDischargeDraft(patientId);
}

export async function getWardDetail(session: SessionContext, wardId: string) {
  requireWardAccess(session, wardId);
  const summaries = await getWardSummaries(session);
  return summaries.find((summary) => summary.ward.id === wardId) ?? null;
}

export async function getPatientBundle(
  session: SessionContext,
  patientId: string,
): Promise<PatientBundle | null> {
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
  const patientMap = new Map(
    store.patients
      .filter((patient) => patient.lifecycle === "active")
      .map((patient) => [patient.id, patient]),
  );

  return store.tasks
    .filter(
      (task) =>
        patientMap.has(task.patientId) &&
        (task.ownerId === session.profile.id || session.profile.role === "admin"),
    )
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
              ? `Escalation: ${patient.handover.escalationInstruction}`
              : "",
          ]
            .filter(Boolean)
            .join("\n");
        });

      return [`Ward: ${bundle.ward.name}`, ...patientLines].join("\n\n");
    })
    .join("\n\n--------------------\n\n");
}

export async function saveWard(formData: FormData, session: SessionContext) {
  if (!canManageAdmin(session)) {
    throw new Error("Admin only");
  }

  const parsed = wardSchema.parse({
    id: textOrNull(formData.get("id")) ?? undefined,
    name: formData.get("name"),
  });

  if (parsed.id) {
    const ward = store.wards.find((entry) => entry.id === parsed.id);
    if (!ward) throw new Error("Ward not found");
    ward.name = parsed.name;
  } else {
    store.wards.push({ id: nextId("ward"), name: parsed.name });
  }

  revalidatePath("/wards");
  revalidatePath("/admin/wards");
  revalidatePath("/discharged");
}

export async function deleteWard(formData: FormData, session: SessionContext) {
  if (!canManageAdmin(session)) {
    throw new Error("Admin only");
  }

  const parsed = deleteWardSchema.parse({
    wardId: formData.get("wardId"),
  });

  const hasPatients = store.patients.some((patient) => patient.wardId === parsed.wardId);
  if (hasPatients) {
    throw new Error("Ward with patients cannot be deleted");
  }

  store.wards = store.wards.filter((ward) => ward.id !== parsed.wardId);
  store.profiles = store.profiles.map((profile) =>
    profile.wardAssignment === parsed.wardId ? { ...profile, wardAssignment: null } : profile,
  );

  revalidatePath("/wards");
  revalidatePath("/admin/wards");
  revalidatePath("/discharged");
}

export async function updateUserRole(formData: FormData, session: SessionContext) {
  if (!canManageAdmin(session)) {
    throw new Error("Admin only");
  }

  const parsed = userRoleSchema.parse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });

  const profile = store.profiles.find((entry) => entry.id === parsed.userId);
  if (!profile) throw new Error("User not found");
  profile.role = parsed.role as Role;

  revalidatePath("/admin/wards");
}

export async function savePatient(formData: FormData, session: SessionContext) {
  const parsed = patientSchema.parse({
    id: textOrNull(formData.get("id")) ?? undefined,
    wardId: formData.get("wardId"),
    bed: formData.get("bed"),
    displayName: formData.get("displayName"),
    diagnosis: formData.get("diagnosis"),
    status: formData.get("status"),
    responsibleDoctorId: textOrNull(formData.get("responsibleDoctorId")),
    precaution: formData.get("precaution"),
  });
  requireWardAccess(session, parsed.wardId);

  const ownerName = getPatientDirectoryName(parsed.responsibleDoctorId ?? null, session.profile.name);

  if (parsed.id) {
    if (!canManageClinicalEntries(session)) {
      throw new Error("Clinical entries are not allowed");
    }
    const existing = patientById(parsed.id);
    if (!existing) throw new Error("Patient not found");
    const before = structuredClone(existing);
    existing.wardId = parsed.wardId;
    existing.bed = parsed.bed;
    existing.displayName = parsed.displayName;
    existing.diagnosis = parsed.diagnosis;
    existing.status = parsed.status;
    existing.responsibleDoctorId = parsed.responsibleDoctorId ?? session.profile.id;
    existing.responsibleDoctorName = ownerName;
    existing.precaution = parsed.precaution;
    existing.lastUpdate = now();
    addActivity(session, existing.id, "patient.updated", "patient", existing.id, before, existing);
  } else {
    if (!canManagePatients(session)) {
      throw new Error("Only admin or resident can admit patient");
    }
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
      responsibleDoctorName: ownerName,
      allergy: null,
      precaution: parsed.precaution,
      codeStatus: null,
      lifecycle: "active",
      dischargedAt: null,
      lastUpdate: now(),
    };
    store.patients.push(patient);
    addActivity(session, patient.id, "patient.created", "patient", patient.id, null, patient);
  }

  revalidatePath("/wards");
  revalidatePath("/discharged");
}

export async function dischargePatient(patientId: string, session: SessionContext) {
  if (!canManagePatients(session)) {
    throw new Error("Only admin or resident can discharge patient");
  }

  const patient = patientById(patientId);
  if (!patient) throw new Error("Patient not found");
  requireWardAccess(session, patient.wardId);

  const before = structuredClone(patient);
  patient.lifecycle = "discharged";
  patient.dischargedAt = now();
  patient.lastUpdate = patient.dischargedAt;
  addActivity(session, patient.id, "patient.discharged", "patient", patient.id, before, patient);

  revalidatePath("/wards");
  revalidatePath("/discharged");
  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/handover");
  revalidatePath("/my-tasks");
}

export async function dischargePatientWithSummary(formData: FormData, session: SessionContext) {
  if (!canManagePatients(session)) {
    throw new Error("Only admin or resident can discharge patient");
  }

  const parsed = dischargeSummarySchema.parse({
    patientId: formData.get("patientId"),
    primaryDiagnosis: formData.get("primaryDiagnosis"),
    hospitalCourse: String(formData.get("hospitalCourse") ?? ""),
    plan: String(formData.get("plan") ?? ""),
    homeMedication: String(formData.get("homeMedication") ?? ""),
  });

  const patient = patientById(parsed.patientId);
  if (!patient) throw new Error("Patient not found");
  requireWardAccess(session, patient.wardId);

  const dischargeDate = now();
  const admitDate = getPatientAdmitDate(patient.id) ?? "";

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
  addActivity(session, patient.id, "discharge.summary_created", "discharge_summary", summary.id, null, summary);

  await dischargePatient(patient.id, session);
}

export async function saveProblem(formData: FormData, session: SessionContext) {
  if (!canManageClinicalEntries(session)) {
    throw new Error("Clinical entries are not allowed");
  }

  const parsed = problemSchema.parse({
    id: textOrNull(formData.get("id")) ?? undefined,
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

  if (parsed.id) {
    const existing = store.problems.find((entry) => entry.id === parsed.id);
    if (!existing) throw new Error("Problem not found");
    const before = structuredClone(existing);
    existing.title = parsed.title;
    existing.status = parsed.status;
    existing.keyData = parsed.keyData ?? null;
    existing.plan = parsed.plan ?? null;
    existing.pending = parsed.pending ?? null;
    existing.watchOut = parsed.watchOut ?? null;
    existing.includeInHandover = parsed.includeInHandover;
    existing.updatedAt = now();
    addActivity(session, parsed.patientId, "problem.updated", "problem", existing.id, before, existing);
  } else {
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
  }

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
  if (!canManageClinicalEntries(session)) {
    throw new Error("Clinical entries are not allowed");
  }

  const bundle = await getPatientBundle(session, patientId);
  if (!bundle) return;
  const currentIndex = bundle.problems.findIndex((problem) => problem.id === problemId);
  const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || swapIndex < 0 || swapIndex >= bundle.problems.length) return;

  const current = store.problems.find((problem) => problem.id === bundle.problems[currentIndex].id);
  const swap = store.problems.find((problem) => problem.id === bundle.problems[swapIndex].id);
  if (!current || !swap) return;

  const fromOrder = current.sortOrder;
  const toOrder = swap.sortOrder;
  [current.sortOrder, swap.sortOrder] = [swap.sortOrder, current.sortOrder];
  current.updatedAt = now();
  swap.updatedAt = now();
  addActivity(
    session,
    patientId,
    "problem.reordered",
    "problem",
    problemId,
    { from: fromOrder, to: toOrder },
    { from: toOrder, to: fromOrder },
  );
  refreshPatient(patientId);
  revalidatePath(`/patients/${patientId}`);
}

export async function saveTask(formData: FormData, session: SessionContext) {
  if (!canManageClinicalEntries(session)) {
    throw new Error("Clinical entries are not allowed");
  }

  const parsed = taskSchema.parse({
    id: textOrNull(formData.get("id")) ?? undefined,
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
  if (parsed.id) {
    const existing = store.tasks.find((entry) => entry.id === parsed.id);
    if (!existing) throw new Error("Task not found");
    const before = structuredClone(existing);
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
    addActivity(session, parsed.patientId, "task.updated", "ward_task", existing.id, before, existing);
  } else {
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
  }

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
  if (!canManageClinicalEntries(session)) {
    throw new Error("Clinical entries are not allowed");
  }

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
  if (!canManageClinicalEntries(session)) {
    throw new Error("Clinical entries are not allowed");
  }

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
  if (!canManageAdmin(session)) {
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
