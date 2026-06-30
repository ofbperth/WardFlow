import { clsx } from "clsx";
import { format, formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import type {
  PatientLifecycle,
  PatientStatus,
  Precaution,
  ProblemPriority,
  ProblemStatus,
  Role,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/lib/types";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return format(new Date(value), "d MMM yyyy HH:mm", { locale: th });
}

export function formatShortTime(value: string | null | undefined) {
  if (!value) return "-";
  return `${format(new Date(value), "HH:mm", { locale: th })} น.`;
}

export function formatRelative(value: string | null | undefined) {
  if (!value) return "ไม่ระบุ";
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: th });
}

export function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function statusTone(status: PatientStatus | ProblemStatus | TaskStatus) {
  switch (status) {
    case "critical":
    case "worsening":
    case "blocked":
      return "bg-rose-100 text-rose-700";
    case "watch":
      return "bg-amber-100 text-amber-700";
    case "stable":
    case "improving":
    case "done":
      return "bg-emerald-100 text-emerald-700";
    case "active":
    case "in_progress":
      return "bg-sky-100 text-sky-700";
    case "resolved":
      return "bg-slate-100 text-slate-600";
    case "not_started":
    default:
      return "bg-white/70 text-slate-600";
  }
}

export function priorityTone(priority: TaskPriority) {
  switch (priority) {
    case "emergency":
      return "bg-rose-100 text-rose-700";
    case "urgent":
      return "bg-amber-100 text-amber-700";
    case "normal":
    default:
      return "bg-emerald-100 text-emerald-700";
  }
}

export function problemPriorityTone(priority: ProblemPriority) {
  switch (priority) {
    case "ACTIVE_UNSTABLE":
      return "border-rose-200 bg-rose-100 text-rose-700";
    case "ACTIVE_STABLE":
      return "border-orange-200 bg-orange-100 text-orange-700";
    case "MONITORING":
      return "border-amber-200 bg-amber-100 text-amber-700";
    case "RESOLVED_CHRONIC":
    default:
      return "border-emerald-200 bg-emerald-100 text-emerald-700";
  }
}

export function labelForTaskPriority(priority: TaskPriority) {
  switch (priority) {
    case "emergency":
      return "Emergency";
    case "urgent":
      return "Urgent";
    case "normal":
    default:
      return "Normal";
  }
}

export function labelForProblemPriority(priority: ProblemPriority) {
  switch (priority) {
    case "ACTIVE_UNSTABLE":
      return "Active unstable";
    case "ACTIVE_STABLE":
      return "Active stable";
    case "MONITORING":
      return "Monitoring";
    case "RESOLVED_CHRONIC":
    default:
      return "Resolved / chronic";
  }
}

export function labelForTaskType(type: TaskType) {
  return {
    lab: "Lab",
    imaging: "Imaging",
    consult: "Consult",
    procedure: "Procedure",
    family_talk: "Family talk",
    discharge: "Discharge",
    medication: "Medication",
    other: "Other",
  }[type];
}

export function labelForRole(role: Role) {
  return {
    admin: "Admin",
    resident: "Resident",
    student: "Student",
  }[role];
}

export function labelForPatientStatus(status: PatientStatus) {
  return {
    stable: "Stable",
    watch: "Watch",
    critical: "Critical",
  }[status];
}

export function labelForProblemStatus(status: ProblemStatus) {
  return {
    active: "Active",
    improving: "Improving",
    worsening: "Worsening",
    resolved: "Resolved",
  }[status];
}

export function labelForTaskStatus(status: TaskStatus) {
  return {
    not_started: "Not started",
    in_progress: "In progress",
    done: "Done",
    blocked: "Blocked",
  }[status];
}

export function labelForLifecycle(lifecycle: PatientLifecycle) {
  return {
    active: "Active",
    discharged: "Discharged",
  }[lifecycle];
}

export function labelForPrecaution(precaution: Precaution) {
  return {
    none: "None",
    contact: "Contact",
    droplet: "Droplet",
    airborne: "Airborne",
  }[precaution];
}

export function labelForActivityAction(action: string) {
  return (
    {
      "patient.created": "สร้างผู้ป่วยใหม่",
      "patient.updated": "อัปเดตข้อมูลผู้ป่วย",
      "patient.discharged": "จำหน่ายผู้ป่วย",
      "problem.created": "เพิ่ม problem list",
      "problem.updated": "อัปเดต problem list",
      "problem.reordered": "จัดลำดับ problem list",
      "task.created": "สร้าง task",
      "task.updated": "อัปเดต task",
      "task.status_changed": "เปลี่ยนสถานะ task",
      "handover.updated": "บันทึก handover",
    }[action] ?? action
  );
}

export function compareProblemPriority(left: ProblemPriority, right: ProblemPriority) {
  const weight = (priority: ProblemPriority) => {
    switch (priority) {
      case "ACTIVE_UNSTABLE":
        return 0;
      case "ACTIVE_STABLE":
        return 1;
      case "MONITORING":
        return 2;
      case "RESOLVED_CHRONIC":
      default:
        return 3;
    }
  };

  return weight(left) - weight(right);
}
