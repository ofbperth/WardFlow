import { clsx } from "clsx";
import { format, formatDistanceToNow } from "date-fns";
import type {
  PatientStatus,
  ProblemStatus,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/lib/types";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return format(new Date(value), "dd MMM yyyy HH:mm");
}

export function formatShortTime(value: string | null | undefined) {
  if (!value) return "-";
  return format(new Date(value), "HH:mm");
}

export function formatRelative(value: string | null | undefined) {
  if (!value) return "ไม่ระบุ";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
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
    case "waiting":
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
    case "urgent":
      return "bg-rose-100 text-rose-700";
    case "high":
      return "bg-amber-100 text-amber-700";
    case "normal":
      return "bg-emerald-100 text-emerald-700";
    case "low":
    default:
      return "bg-slate-100 text-slate-600";
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
