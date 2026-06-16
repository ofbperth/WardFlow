export const roleValues = ["admin", "resident", "student"] as const;
export const patientStatusValues = ["stable", "watch", "critical"] as const;
export const patientLifecycleValues = ["active", "discharged"] as const;
export const problemStatusValues = ["active", "improving", "worsening", "resolved"] as const;
export const taskStatusValues = [
  "not_started",
  "in_progress",
  "waiting",
  "done",
  "blocked",
] as const;
export const taskPriorityValues = ["low", "normal", "high", "urgent"] as const;
export const taskTypeValues = [
  "lab",
  "imaging",
  "consult",
  "procedure",
  "family_talk",
  "discharge",
  "medication",
  "other",
] as const;

export type Role = (typeof roleValues)[number];
export type PatientStatus = (typeof patientStatusValues)[number];
export type PatientLifecycle = (typeof patientLifecycleValues)[number];
export type ProblemStatus = (typeof problemStatusValues)[number];
export type TaskStatus = (typeof taskStatusValues)[number];
export type TaskPriority = (typeof taskPriorityValues)[number];
export type TaskType = (typeof taskTypeValues)[number];

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Ward = {
  id: string;
  name: string;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  wardAssignment: string | null;
};

export type Patient = {
  id: string;
  wardId: string;
  bed: string;
  displayName: string;
  age: number | null;
  sex: string | null;
  diagnosis: string;
  status: PatientStatus;
  responsibleDoctorId: string | null;
  responsibleDoctorName: string | null;
  allergy: string | null;
  isolationFlag: boolean;
  codeStatus: string | null;
  lifecycle: PatientLifecycle;
  dischargedAt: string | null;
  lastUpdate: string;
};

export type Problem = {
  id: string;
  patientId: string;
  title: string;
  status: ProblemStatus;
  keyData: string | null;
  plan: string | null;
  pending: string | null;
  watchOut: string | null;
  includeInHandover: boolean;
  sortOrder: number;
  updatedAt: string;
};

export type WardTask = {
  id: string;
  patientId: string;
  title: string;
  note: string | null;
  ownerId: string | null;
  ownerName: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  dueAt: string | null;
  blockedReason: string | null;
  updatedById: string | null;
  updatedByName: string | null;
  updatedAt: string;
};

export type HandoverNote = {
  id: string;
  patientId: string;
  note: string;
  escalationInstruction: string | null;
  updatedAt: string;
};

export type ActivityLog = {
  id: string;
  patientId: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: Json | null;
  afterJson: Json | null;
  createdAt: string;
};

export type TaskTemplate = {
  id: string;
  title: string;
  type: TaskType;
  defaultPriority: TaskPriority;
};

export type WardSummary = {
  ward: Ward;
  patients: Array<
    Patient & {
      pendingTaskCount: number;
      blockedTaskCount: number;
    }
  >;
};

export type PatientBundle = {
  patient: Patient;
  ward: Ward | null;
  problems: Problem[];
  tasks: WardTask[];
  handover: HandoverNote | null;
  activity: ActivityLog[];
};

export type HandoverBundle = {
  ward: Ward;
  patients: Array<
    Patient & {
      problems: Problem[];
      tasks: WardTask[];
      handover: HandoverNote | null;
    }
  >;
};

export type SessionContext = {
  profile: UserProfile;
  mode: "demo" | "live";
};
