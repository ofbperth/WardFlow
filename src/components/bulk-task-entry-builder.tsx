"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardList, Plus, Sparkles, Trash2, UserRound } from "lucide-react";
import { PendingSubmitButton } from "@/components/form-feedback";
import { Field, SectionLabel, SelectBox, TextArea, TextInput } from "@/components/wardflow-ui";
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

      <div className="grid gap-3 xl:grid-cols-[0.86fr_1.14fr]">
        <div className="rounded-[26px] border clinical-divider bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SectionLabel>Ward focus</SectionLabel>
              <h3 className="text-lg font-semibold text-foreground">{wardSummary.ward.name}</h3>
            </div>
            <div className="rounded-full bg-mint-50 px-3 py-1.5 text-xs font-semibold text-mint-700">
              {wardSummary.patients.length} active
            </div>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <WorkbenchMiniCard
              icon={ClipboardList}
              label="Instant actions"
              value={`${instantTemplates.length} templates`}
            />
            <WorkbenchMiniCard
              icon={UserRound}
              label="Assignable staff"
              value={`${profiles.length} profiles`}
            />
          </div>
        </div>

        <div className="rounded-[26px] border clinical-divider bg-white p-4">
          <SectionLabel>Default kit</SectionLabel>
          <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)]">
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
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Patients in queue</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{wardSummary.ward.name}</h3>
          </div>
          <div className="rounded-full bg-[var(--surface-muted)] px-3.5 py-1.5 text-sm font-semibold text-foreground">
            {wardSummary.patients.length} active
          </div>
        </div>

        <div className="space-y-3">
          {wardSummary.patients.map((patient) => {
            const patientRows = rowsByPatient[patient.id] ?? [];

            return (
              <div key={patient.id} className="rounded-[26px] border clinical-divider bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        Bed {patient.bed}
                      </span>
                      {patient.pendingTaskCount ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800">
                          {patient.pendingTaskCount} pending
                        </span>
                      ) : null}
                      {patient.blockedTaskCount ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700">
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
                        className="rounded-full border border-mint-200 bg-mint-50 px-2.5 py-1.5 text-xs font-semibold text-mint-700 transition hover:bg-mint-100"
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
                      className="rounded-full border border-amber-400 bg-white px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-amber-50"
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
                    <div key={row.id} className="rounded-[22px] border clinical-divider bg-[var(--surface)] p-3.5 md:p-4">
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
                            "inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50",
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
                          className="bg-mint-600 px-4 py-2 text-sm shadow-none hover:bg-mint-700"
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
                    <div className="rounded-[20px] border border-dashed clinical-divider bg-[var(--surface-muted)] px-4 py-3 text-sm font-medium text-foreground">
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

function WorkbenchMiniCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] bg-[var(--surface-muted)] px-4 py-3.5">
      <div className="flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4 text-mint-600" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-2 text-base font-semibold leading-none text-foreground">{value}</p>
    </div>
  );
}
