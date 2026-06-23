"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import { EmptyState, GlassPanel, Pill, TextInput } from "@/components/wardflow-ui";
import { cn } from "@/lib/utils";
import type { Student, StudentWardAssignmentWard } from "@/lib/types";

type AssignmentRowDraft = {
  key: string;
  assignmentId: string | null;
  studentId: string;
};

type ToastState = {
  tone: "success" | "error";
  message: string;
} | null;

function buildRowKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function buildRowsFromWard(ward: StudentWardAssignmentWard): AssignmentRowDraft[] {
  return ward.assignments.map((entry) => ({
    key: buildRowKey("assignment"),
    assignmentId: entry.assignment.id,
    studentId: entry.student.id,
  }));
}

function sameStudentIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function studentLabel(student: Student) {
  const extras = [student.studentCode, student.academicYear].filter(Boolean).join(" • ");
  return extras ? `${student.name} (${extras})` : student.name;
}

export function StudentWardAssignmentBoard() {
  const [wards, setWards] = useState<StudentWardAssignmentWard[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [rowsByWard, setRowsByWard] = useState<Record<string, AssignmentRowDraft[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [savingWardId, setSavingWardId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const [wardResponse, studentResponse] = await Promise.all([
          fetch("/api/admin/student-ward-assignment/wards", { cache: "no-store" }),
          fetch("/api/admin/student-ward-assignment/students", { cache: "no-store" }),
        ]);

        const wardPayload = (await wardResponse.json()) as {
          ok: boolean;
          data?: StudentWardAssignmentWard[];
          error?: string;
        };
        const studentPayload = (await studentResponse.json()) as {
          ok: boolean;
          data?: Student[];
          error?: string;
        };

        if (!wardResponse.ok || !wardPayload.ok) {
          throw new Error(wardPayload.error ?? "โหลดวอร์ดไม่สำเร็จ");
        }

        if (!studentResponse.ok || !studentPayload.ok) {
          throw new Error(studentPayload.error ?? "โหลดรายชื่อนักศึกษาไม่สำเร็จ");
        }

        if (!mounted) return;

        setWards(wardPayload.data ?? []);
        setStudents(studentPayload.data ?? []);
        setRowsByWard(
          Object.fromEntries((wardPayload.data ?? []).map((ward) => [ward.ward.id, buildRowsFromWard(ward)])),
        );
      } catch (error) {
        if (!mounted) return;
        setToast({
          tone: "error",
          message: error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ",
        });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const visibleWards = wards.filter((ward) =>
    deferredSearch.trim()
      ? ward.ward.name.toLowerCase().includes(deferredSearch.trim().toLowerCase())
      : true,
  );

  function refreshBoard() {
    startTransition(() => {
      setRefreshKey((value) => value + 1);
    });
  }

  function updateWardRows(wardId: string, updater: (rows: AssignmentRowDraft[]) => AssignmentRowDraft[]) {
    setRowsByWard((current) => ({
      ...current,
      [wardId]: updater(current[wardId] ?? []),
    }));
  }

  function addRow(wardId: string) {
    updateWardRows(wardId, (rows) => [...rows, { key: buildRowKey("new-assignment"), assignmentId: null, studentId: "" }]);
  }

  function removeRow(wardId: string, rowKey: string) {
    updateWardRows(wardId, (rows) => rows.filter((row) => row.key !== rowKey));
  }

  function changeStudent(wardId: string, rowKey: string, studentId: string) {
    updateWardRows(wardId, (rows) =>
      rows.map((row) => (row.key === rowKey ? { ...row, studentId } : row)),
    );
  }

  async function saveWard(ward: StudentWardAssignmentWard) {
    const rows = (rowsByWard[ward.ward.id] ?? []).filter((row) => row.studentId);
    const studentIds = rows.map((row) => row.studentId);
    const duplicateIds = studentIds.filter((studentId, index) => studentIds.indexOf(studentId) !== index);

    if (duplicateIds.length > 0) {
      setToast({ tone: "error", message: "ห้ามเลือกนักศึกษาซ้ำในวอร์ดเดียวกัน" });
      return;
    }

    const originalStudentIds = ward.assignments.map((entry) => entry.student.id);
    if (sameStudentIds(studentIds, originalStudentIds)) {
      setToast({ tone: "success", message: "ไม่มีการเปลี่ยนแปลงให้บันทึก" });
      return;
    }

    const crossWardConflicts = wards
      .filter((entry) => entry.ward.id !== ward.ward.id)
      .flatMap((entry) =>
        entry.assignments
          .filter((assignment) => studentIds.includes(assignment.student.id))
          .map((assignment) => ({
            studentName: assignment.student.name,
            fromWardName: entry.ward.name,
          })),
      );

    let forceMove = false;
    if (crossWardConflicts.length > 0) {
      forceMove = window.confirm(
        `นักศึกษาบางคนอยู่ในวอร์ดอื่นแล้ว:\n${crossWardConflicts
          .map((entry) => `- ${entry.studentName} จาก ${entry.fromWardName}`)
          .join("\n")}\n\nกดยืนยันเพื่อย้ายมายังวอร์ดนี้`,
      );
      if (!forceMove) {
        return;
      }
    }

    setSavingWardId(ward.ward.id);
    try {
      const response = await fetch(`/api/admin/student-ward-assignment/wards/${ward.ward.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds, forceMove }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        detail?: string;
      };

      if (response.status === 409 && payload.error === "MOVE_REQUIRED") {
        const moveDetails = payload.detail ? JSON.parse(payload.detail) as Array<{ studentName: string }> : [];
        const confirmed = window.confirm(
          `นักศึกษาต่อไปนี้ถูก assign อยู่ที่อื่น:\n${moveDetails
            .map((entry) => `- ${entry.studentName}`)
            .join("\n")}\n\nต้องการย้ายต่อหรือไม่`,
        );
        if (confirmed) {
          const retry = await fetch(`/api/admin/student-ward-assignment/wards/${ward.ward.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentIds, forceMove: true }),
          });
          const retryPayload = (await retry.json()) as { ok: boolean; error?: string };
          if (!retry.ok || !retryPayload.ok) {
            throw new Error(retryPayload.error ?? "บันทึกไม่สำเร็จ");
          }
        } else {
          return;
        }
      } else if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "บันทึกไม่สำเร็จ");
      }

      setToast({ tone: "success", message: "บันทึกการจัดนักศึกษาเข้าวอร์ดแล้ว" });
      refreshBoard();
    } catch (error) {
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : "บันทึกไม่สำเร็จ",
      });
    } finally {
      setSavingWardId(null);
    }
  }

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div
            className={cn(
              "app-panel flex items-center gap-3 rounded-full border px-4 py-3 text-sm font-semibold shadow-2xl",
              toast.tone === "success"
                ? "border-[color:var(--color-accent)]/20 text-foreground"
                : "border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]",
            )}
          >
            <div
              className={cn(
                "rounded-full p-1",
                toast.tone === "success"
                  ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-strong)]"
                  : "bg-white text-[color:var(--color-danger)]",
              )}
            >
              {toast.tone === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
            </div>
            <span>{toast.message}</span>
          </div>
        </div>
      ) : null}

      <GlassPanel
        title="Student Ward Assignment"
        className="border clinical-divider bg-white/92"
        action={
          <div className="flex items-center gap-2 rounded-full bg-[color:var(--color-accent-soft)] px-4 py-2 text-sm font-semibold text-[color:var(--color-accent-strong)]">
            <CheckCircle2 className="h-4 w-4" />
            Admin only
          </div>
        }
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex items-center gap-3 rounded-[22px] border clinical-divider bg-[color:var(--color-paper-3)] px-4 py-3">
            <Search className="h-4 w-4 text-[color:var(--color-accent-strong)]" />
            <TextInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาวอร์ดตามชื่อ"
            className="border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0"
            />
          </label>
          <div className="rounded-[22px] border clinical-divider bg-white/80 px-4 py-3 text-sm text-muted">
            {students.length} active students
          </div>
        </div>
      </GlassPanel>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`loading-${index}`}
              className="rounded-[30px] border clinical-divider bg-[color:var(--color-paper-3)] p-6 shadow-lg"
            >
              <div className="h-5 w-40 animate-pulse rounded-full bg-white" />
              <div className="mt-3 h-4 w-24 animate-pulse rounded-full bg-white" />
              <div className="mt-6 space-y-3">
                <div className="h-12 animate-pulse rounded-2xl bg-white/80" />
                <div className="h-12 animate-pulse rounded-2xl bg-white/80" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && visibleWards.length === 0 ? (
        <EmptyState
          title="ยังไม่มีวอร์ด"
          body={search.trim() ? "ไม่พบวอร์ดตามคำค้นนี้" : "สร้างหรือเปิดใช้งานวอร์ดก่อน"}
        />
      ) : null}

      {!loading ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visibleWards.map((ward) => {
            const draftRows = rowsByWard[ward.ward.id] ?? [];
            const filledStudentIds = draftRows.map((row) => row.studentId).filter(Boolean);
            const isSaving = savingWardId === ward.ward.id;

            return (
              <section
                key={ward.ward.id}
                className="rounded-[30px] border clinical-divider bg-white/92 p-5 shadow-xl shadow-[color:var(--color-shadow-soft)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-ink-2)]">
                      Ward
                    </p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-foreground">
                      {ward.ward.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      {ward.ward.location?.trim() ? ward.ward.location : "Location not set"}
                    </p>
                  </div>
                  <Pill tone="border-[color:var(--color-rule)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-strong)]">
                    {filledStudentIds.length} {filledStudentIds.length === 1 ? "student" : "students"}
                  </Pill>
                </div>

                <div className="mt-5 space-y-3">
                  {draftRows.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed clinical-divider bg-[color:var(--color-paper-3)] px-4 py-5 text-sm text-muted">
                      ยังไม่มีนักศึกษาในวอร์ดนี้
                    </div>
                  ) : null}

                  {draftRows.map((row, index) => (
                    <div
                      key={row.key}
                      className="rounded-[24px] border clinical-divider bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-2)]">
                            Student {index + 1}
                          </label>
                          <select
                            value={row.studentId}
                            onChange={(event) => changeStudent(ward.ward.id, row.key, event.target.value)}
                            className="w-full rounded-2xl border clinical-divider bg-[color:var(--color-paper-3)] px-3 py-3 text-sm text-foreground outline-none transition focus:border-[color:var(--color-focus)] focus:bg-white"
                          >
                            <option value="">เลือกนักศึกษา</option>
                            {students.map((student) => {
                              const selectedSomewhereElse =
                                filledStudentIds.includes(student.id) && student.id !== row.studentId;
                              return (
                                <option key={student.id} value={student.id} disabled={selectedSomewhereElse}>
                                  {studentLabel(student)}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRow(ward.ward.id, row.key)}
                          className="button-danger mt-6 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                          aria-label="ลบนักศึกษา"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addRow(ward.ward.id)}
                    className="button-secondary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[color:var(--color-accent-strong)]"
                  >
                    <Plus className="h-4 w-4" />
                    Add Student
                  </button>
                  <button
                    type="button"
                    onClick={() => saveWard(ward)}
                    disabled={isSaving}
                    className="button-accent inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isSaving ? "กำลังบันทึก..." : "Save Assignment"}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
