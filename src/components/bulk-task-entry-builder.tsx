"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Sparkles, Trash2 } from "lucide-react";
import { PendingSubmitButton } from "@/components/form-feedback";
import { Field, SelectBox, TextArea, TextInput } from "@/components/wardflow-ui";
import { cn, labelForRole, labelForTaskPriority, labelForTaskType } from "@/lib/utils";
import type { BulkTaskDraft, TaskTemplate, UserProfile, WardSummary } from "@/lib/types";

type DraftRow = BulkTaskDraft & {
  id: string;
};

const instantTemplateTitles = ["Follow lab", "Consult", "Procedure prep"] as const;

function makeDraftRow(patientId: string, defaults: Omit<BulkTaskDraft, "patientId" | "title" | "note">): DraftRow {
  return {
    id: crypto.randomUUID(),
    patientId,
    title: "",
    ownerId: defaults.ownerId,
    priority: defaults.priority,
    type: defaults.type,
    note: null,
  };
}

function normalizeTemplateTitle(title: string) {
  return title === "Consult specialist" ? "Consult" : title;
}

function serializeRow(row: DraftRow) {
  return JSON.stringify({
    rows: [
      {
        patientId: row.patientId,
        title: row.title,
        ownerId: row.ownerId,
        priority: row.priority,
        type: row.type,
        note: row.note,
      },
    ],
  });
}

export function BulkTaskEntryBuilder({
  wardSummary,
  templates,
  profiles,
  submitAction,
}: {
  wardSummary: WardSummary;
  templates: TaskTemplate[];
  profiles: UserProfile[];
  submitAction: (formData: FormData) => Promise<void>;
}) {
  const [defaultOwnerId, setDefaultOwnerId] = useState("");
  const [defaultPriority, setDefaultPriority] = useState<BulkTaskDraft["priority"]>("normal");
  const [defaultType, setDefaultType] = useState<BulkTaskDraft["type"]>("other");
  const [rowsByPatient, setRowsByPatient] = useState<Record<string, DraftRow[]>>({});

  const instantTemplates = useMemo(() => {
    const templateMap = new Map(templates.map((template) => [normalizeTemplateTitle(template.title), template]));
    return instantTemplateTitles
      .map((title) => templateMap.get(title))
      .filter((template): template is TaskTemplate => Boolean(template));
  }, [templates]);

  const defaults = {
    ownerId: defaultOwnerId || null,
    priority: defaultPriority,
    type: defaultType,
  } as const;

  return (
    <form action={submitAction} className="space-y-4">
      <input type="hidden" name="wardId" value={wardSummary.ward.id} />

      <section className="panel-surface rounded-[26px] p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Ward</p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h3 className="text-lg font-semibold text-foreground">{wardSummary.ward.name}</h3>
              <div className="rounded-full bg-[color:var(--color-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-accent-strong)]">
                {wardSummary.patients.length} active
              </div>
              <div className="rounded-full border border-[color:var(--color-rule)] bg-white px-3 py-1.5 text-xs font-semibold text-muted">
                {instantTemplates.length} instant templates
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)] xl:min-w-[44rem]">
            <label className="block text-sm font-medium text-foreground">
              <span className="mb-1.5 flex items-start text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Responsible doctor
              </span>
              <SelectBox value={defaultOwnerId} onChange={(event) => setDefaultOwnerId(event.target.value)}>
                <option value="">Unassigned</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} ({labelForRole(profile.role)})
                  </option>
                ))}
              </SelectBox>
            </label>

            <label className="block text-sm font-medium text-foreground">
              <span className="mb-1.5 flex items-start text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Default priority
              </span>
              <SelectBox
                value={defaultPriority}
                onChange={(event) => setDefaultPriority(event.target.value as BulkTaskDraft["priority"])}
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </SelectBox>
            </label>

            <label className="block text-sm font-medium text-foreground">
              <span className="mb-1.5 flex items-start text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Default type
              </span>
              <SelectBox
                value={defaultType}
                onChange={(event) => setDefaultType(event.target.value as BulkTaskDraft["type"])}
              >
                <option value="lab">Lab</option>
                <option value="imaging">Imaging</option>
                <option value="consult">Consult</option>
                <option value="procedure">Procedure</option>
                <option value="family_talk">Family talk</option>
                <option value="discharge">Discharge</option>
                <option value="medication">Medication</option>
                <option value="other">Other</option>
              </SelectBox>
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Patients in queue</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{wardSummary.ward.name}</h3>
          </div>
          <div className="rounded-full bg-[color:var(--color-paper-3)] px-3.5 py-1.5 text-sm font-semibold text-foreground">
            {wardSummary.patients.length} active
          </div>
        </div>

        <div className="space-y-3">
          {wardSummary.patients.map((patient) => {
            const patientRows = rowsByPatient[patient.id] ?? [];

            return (
              <div key={patient.id} className="panel-surface rounded-[26px] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[color:var(--color-paper-3)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        Bed {patient.bed}
                      </span>
                      {patient.pendingTaskCount ? (
                          <span className="rounded-full border border-[color:var(--color-warning)]/35 bg-[color:var(--color-warning)]/12 px-3 py-1 text-[11px] font-semibold text-foreground">
                          {patient.pendingTaskCount} pending
                        </span>
                      ) : null}
                      {patient.blockedTaskCount ? (
                          <span className="rounded-full border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-soft)] px-3 py-1 text-[11px] font-semibold text-[color:var(--color-danger)]">
                          {patient.blockedTaskCount} blocked
                        </span>
                      ) : null}
                    </div>
                    <h4 className="mt-2.5 text-[1.3rem] font-semibold text-foreground">{patient.displayName}</h4>
                    <p className="mt-1 text-sm text-muted">{patient.diagnosis}</p>
                    <p className="mt-1.5 text-sm text-foreground/80">
                      Responsible: {patient.responsibleDoctorName ?? "Unassigned"}
                    </p>
                  </div>
                  <div className="flex max-w-full flex-wrap justify-end gap-2">
                    {instantTemplates.map((template) => (
                      <button
                        key={`${patient.id}-${template.id}`}
                        type="button"
                        onClick={() =>
                          setRowsByPatient((current) => ({
                            ...current,
                            [patient.id]: [
                              ...(current[patient.id] ?? []),
                              {
                                ...makeDraftRow(patient.id, defaults),
                                title: normalizeTemplateTitle(template.title),
                                priority: template.defaultPriority,
                                type: template.type,
                              },
                            ],
                          }))
                        }
                        className="rounded-full border border-[color:var(--color-accent)]/20 bg-[color:var(--color-accent-soft)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--color-accent-strong)] transition hover:bg-white"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5" />
                          {normalizeTemplateTitle(template.title)}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setRowsByPatient((current) => ({
                          ...current,
                          [patient.id]: [...(current[patient.id] ?? []), makeDraftRow(patient.id, defaults)],
                        }))
                      }
                        className="button-secondary rounded-full px-2.5 py-1.5 text-xs font-semibold"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Plus className="h-3.5 w-3.5" />
                        Add row
                      </span>
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-2.5">
                  {patientRows.map((row) => (
                    <div key={row.id} className="panel-muted rounded-[22px] p-3.5 md:p-4">
                      <div className="mb-3 flex items-center justify-between gap-3 border-b clinical-divider pb-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Task row</p>
                        <button
                          type="button"
                          onClick={() =>
                            setRowsByPatient((current) => ({
                              ...current,
                              [patient.id]: (current[patient.id] ?? []).filter((entry) => entry.id !== row.id),
                            }))
                          }
                          className={cn(
                            "button-danger inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold",
                          )}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove row
                        </button>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[1.3fr_0.8fr_0.8fr]">
                        <Field label="Task title">
                          <TextInput
                            value={row.title}
                            onChange={(event) =>
                              setRowsByPatient((current) => ({
                                ...current,
                                [patient.id]: (current[patient.id] ?? []).map((entry) =>
                                  entry.id === row.id ? { ...entry, title: event.target.value } : entry,
                                ),
                              }))
                            }
                            placeholder="Type task title"
                          />
                        </Field>
                        <Field label="Template">
                          <SelectBox
                            value=""
                            onChange={(event) => {
                              const template = templates.find((entry) => entry.id === event.target.value);
                              if (!template) return;
                              setRowsByPatient((current) => ({
                                ...current,
                                [patient.id]: (current[patient.id] ?? []).map((entry) =>
                                  entry.id === row.id
                                    ? {
                                        ...entry,
                                        title: normalizeTemplateTitle(template.title),
                                        type: template.type,
                                        priority: template.defaultPriority,
                                      }
                                    : entry,
                                ),
                              }));
                              event.target.value = "";
                            }}
                          >
                            <option value="">Use template</option>
                            {templates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {normalizeTemplateTitle(template.title)}
                              </option>
                            ))}
                          </SelectBox>
                        </Field>
                        <Field label="Responsible doctor">
                          <SelectBox
                            value={row.ownerId ?? ""}
                            onChange={(event) =>
                              setRowsByPatient((current) => ({
                                ...current,
                                [patient.id]: (current[patient.id] ?? []).map((entry) =>
                                  entry.id === row.id
                                    ? { ...entry, ownerId: event.target.value || null }
                                    : entry,
                                ),
                              }))
                            }
                          >
                            <option value="">Unassigned</option>
                            {profiles.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.name} ({labelForRole(profile.role)})
                              </option>
                            ))}
                          </SelectBox>
                        </Field>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Field label="Priority">
                          <SelectBox
                            value={row.priority}
                            onChange={(event) =>
                              setRowsByPatient((current) => ({
                                ...current,
                                [patient.id]: (current[patient.id] ?? []).map((entry) =>
                                  entry.id === row.id
                                    ? {
                                        ...entry,
                                        priority: event.target.value as BulkTaskDraft["priority"],
                                      }
                                    : entry,
                                ),
                              }))
                            }
                          >
                            <option value="normal">{labelForTaskPriority("normal")}</option>
                            <option value="urgent">{labelForTaskPriority("urgent")}</option>
                            <option value="emergency">{labelForTaskPriority("emergency")}</option>
                          </SelectBox>
                        </Field>
                        <Field label="Type">
                          <SelectBox
                            value={row.type}
                            onChange={(event) =>
                              setRowsByPatient((current) => ({
                                ...current,
                                [patient.id]: (current[patient.id] ?? []).map((entry) =>
                                  entry.id === row.id
                                    ? { ...entry, type: event.target.value as BulkTaskDraft["type"] }
                                    : entry,
                                ),
                              }))
                            }
                          >
                            {(["lab", "imaging", "consult", "procedure", "family_talk", "discharge", "medication", "other"] as const).map((type) => (
                              <option key={type} value={type}>
                                {labelForTaskType(type)}
                              </option>
                            ))}
                          </SelectBox>
                        </Field>
                      </div>

                      <div className="mt-3">
                        <Field label="Note">
                          <TextArea
                            value={row.note ?? ""}
                            onChange={(event) =>
                              setRowsByPatient((current) => ({
                                ...current,
                                [patient.id]: (current[patient.id] ?? []).map((entry) =>
                                  entry.id === row.id
                                    ? { ...entry, note: event.target.value || null }
                                    : entry,
                                ),
                              }))
                            }
                            placeholder="Optional note"
                            className="min-h-16"
                          />
                        </Field>
                      </div>

                      <div className="mt-3 flex justify-end border-t clinical-divider pt-3">
                        <PendingSubmitButton
                          pendingLabel="Creating..."
                          className="button-accent px-4 py-2 text-sm shadow-none"
                          name="payload"
                          value={serializeRow(row)}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5" />
                            Confirm quick task
                          </span>
                        </PendingSubmitButton>
                      </div>
                    </div>
                  ))}

                  {!patientRows.length ? (
                    <div className="rounded-[20px] border border-dashed clinical-divider bg-[color:var(--color-paper-3)] px-4 py-3 text-sm font-medium text-foreground">
                      No task rows yet
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </form>
  );
}
