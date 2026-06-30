export const roleValues = ["admin", "resident", "student"] as const;
export const patientStatusValues = ["stable", "watch", "critical"] as const;
export const patientLifecycleValues = ["active", "discharged"] as const;
export const precautionValues = ["none", "contact", "droplet", "airborne"] as const;
export const problemStatusValues = ["active", "improving", "worsening", "resolved"] as const;
export const problemPriorityValues = [
  "ACTIVE_UNSTABLE",
  "ACTIVE_STABLE",
  "MONITORING",
  "RESOLVED_CHRONIC",
] as const;
export const taskStatusValues = [
  "not_started",
  "in_progress",
  "done",
  "blocked",
] as const;
export const taskPriorityValues = ["normal", "urgent", "emergency"] as const;
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
export type Precaution = (typeof precautionValues)[number];
export type ProblemStatus = (typeof problemStatusValues)[number];
export type ProblemPriority = (typeof problemPriorityValues)[number];
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
  location?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  wardAssignment: string | null;
  studentCode?: string | null;
  academicYear?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Student = {
  id: string;
  name: string;
  studentCode: string | null;
  academicYear: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  wardAssignment: string | null;
};

export type StudentWardAssignment = {
  id: string;
  studentId: string;
  wardId: string;
  assignedByUserId: string | null;
  assignedAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StudentWardAssignmentEntry = {
  assignment: StudentWardAssignment;
  student: Student;
};

export type StudentWardAssignmentWard = {
  ward: Ward;
  assignments: StudentWardAssignmentEntry[];
  assignedStudentCount: number;
};

export type StudentWardAssignmentBoardData = {
  wards: StudentWardAssignmentWard[];
  students: Student[];
};

export type Patient = {
  id: string;
  wardId: string;
  bed: string;
  displayName: string;
  age: number | null;
  sex: string | null;
  underlyingDisease: string | null;
  diagnosis: string;
  status: PatientStatus;
  responsibleDoctorId: string | null;
  responsibleDoctorName: string | null;
  allergy: string | null;
  precaution: Precaution;
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
  priority: ProblemPriority;
  currentStatus: string | null;
  evidence: string | null;
  treatment: string | null;
  reasoning: string | null;
  todayPlan: string | null;
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
  problemId: string | null;
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

export type TaskUpdate = {
  id: string;
  taskId: string;
  note: string;
  createdById: string | null;
  createdByName: string;
  createdAt: string;
};

export type TaskWithUpdates = WardTask & {
  updates: TaskUpdate[];
};

export type HandoverNote = {
  id: string;
  patientId: string;
  note: string;
  escalationInstruction: string | null;
  updatedAt: string;
};

export type DischargeSummary = {
  id: string;
  patientId: string;
  wardId: string;
  createdById: string | null;
  createdByName: string;
  createdAt: string;
  admitDate: string;
  dischargeDate: string;
  lengthOfStay: string;
  primaryDiagnosis: string;
  hospitalCourse: string;
  plan: string;
  homeMedication: string;
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

export type WardPatientSummary = Patient & {
  pendingTaskCount: number;
  blockedTaskCount: number;
  overdueTaskCount: number;
  urgentTaskCount: number;
  highestPriorityProblem: {
    id: string;
    title: string;
    priority: ProblemPriority;
    currentStatus: string | null;
  } | null;
};

export type WardSummary = {
  ward: Ward;
  patients: WardPatientSummary[];
};

export type PatientBundle = {
  patient: Patient;
  ward: Ward | null;
  problems: Problem[];
  tasks: TaskWithUpdates[];
  handover: HandoverNote | null;
  activity: ActivityLog[];
};

export type DischargedDirectoryItem = {
  patient: Patient;
  ward: Ward | null;
  summary: DischargeSummary | null;
};

export type HandoverBundle = {
  ward: Ward;
  patients: Array<
    Patient & {
      problems: Problem[];
      tasks: TaskWithUpdates[];
      handover: HandoverNote | null;
    }
  >;
};

export type BulkTaskDraft = {
  patientId: string;
  title: string;
  ownerId: string | null;
  priority: TaskPriority;
  type: TaskType;
  note: string | null;
};

export type BulkTaskPayload = {
  rows: BulkTaskDraft[];
};

export type TaskWorkspaceFilters = {
  wardId: string;
  ownerId: string;
  type: TaskType | "";
};

export type PendingTaskHandoverMode = "all" | "mine" | "blocked";

export type PendingTaskHandoverFilters = {
  wardId: string;
  mode: PendingTaskHandoverMode;
};

export type TaskWorkspaceGroup = {
  ward: Ward;
  patients: Array<
    Patient & {
      tasks: TaskWithUpdates[];
    }
  >;
};

export type SessionContext = {
  profile: UserProfile;
  mode: "demo" | "live";
};

export type SummaryNoteProblemEntry = {
  id: string;
  title: string;
  priority: ProblemPriority;
  status: string[];
  evidence: string[];
  treatment: string[];
  reasoning: string[];
  todayPlan: string[];
  pendingTasks: string[];
};

export type SummaryNoteSection = {
  heading: string;
  bullets: string[];
};

export type SummaryNotePayload = {
  patientId: string;
  patientLabel: string;
  fileLabel: string;
  dateLabel: string;
  heading: string;
  patientFacts: SummaryNoteSection;
  summaryDate: SummaryNoteSection;
  briefBackground: SummaryNoteSection;
  reasonForAdmission: SummaryNoteSection;
  hospitalCourse: SummaryNoteSection;
  activeProblems: SummaryNoteProblemEntry[];
  resolvedProblems: string[];
  consultations: string[];
  pendingIssues: string[];
  suggestedPlan: string[];
  safetyAlerts: string[];
  tasks: string[];
  plainText: string;
};

export type SummaryNoteExportResult = {
  documentId: string;
  documentUrl: string;
  title: string;
};
