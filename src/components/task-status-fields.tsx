"use client";

import { useState } from "react";
import { taskTypeValues, type TaskType, type TaskStatus } from "@/lib/types";
import { labelForTaskStatus, labelForTaskType, normalizeTaskStatus } from "@/lib/utils";

export function TaskStatusFields({ defaultType = "other", defaultStatus = "not_started" }: {
  defaultType?: TaskType; defaultStatus?: TaskStatus;
}) {
  const [type, setType] = useState(defaultType);
  const [status, setStatus] = useState(() => normalizeTaskStatus(defaultStatus, defaultType));
  const statuses = type === "lab" || type === "imaging"
    ? ["not_started", "in_progress", "done"] as const
    : ["not_started", "done"] as const;
  const selectClass = "mt-1 block min-h-11 w-full rounded-xl border clinical-divider bg-white px-3 py-2 text-sm";
  return <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
    <label className="block text-sm font-medium">Type
      <select name="type" className={selectClass} value={type} onChange={(event) => {
        const nextType = event.target.value as TaskType;
        setType(nextType);
        setStatus(normalizeTaskStatus(status, nextType));
      }}>
        {taskTypeValues.map((value) => <option key={value} value={value}>{labelForTaskType(value)}</option>)}
      </select>
    </label>
    <label className="block text-sm font-medium">Status
      <select name="status" className={selectClass} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
        {statuses.map((value) => <option key={value} value={value}>{labelForTaskStatus(value)}</option>)}
      </select>
    </label>
  </div>;
}
