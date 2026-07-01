import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import {
  dischargePatientWithSummaryAction,
  reorderProblemAction,
  saveHandoverAction,
  savePatientDetailAction,
  saveProblemMasterAction,
  saveProblemProgressEntryAction,
  saveTaskAction,
  saveTaskUpdateAction,
  updateTaskStatusAction,
} from "@/app/actions";
import {
  DischargeSummaryEditor,
  PatientEditor,
  ProblemCreator,
  TaskCreator,
} from "@/components/form-feedback";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import {
  EmptyState,
  Field,
  GlassPanel,
  PageHeader,
  ProblemCards,
  SelectBox,
  StaffOptions,
  SubmitButton,
  SummaryGrid,
  TaskCards,
  TextArea,
  TextInput,
  Timeline,
} from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { formatDateTime, normalizePatientSexOption } from "@/lib/utils";
import {
  getAssignableProfilesForWard,
  getDischargeDraft,
  getPatientBundle,
  getProfiles,
  getTaskTemplates,
} from "@/lib/wardflow";

export default async function PatientPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const session = await requireAppSession();
  const { patientId } = await params;
  const [bundle, profiles, templates, dischargeDraft] = await Promise.all([
    getPatientBundle(session, patientId),
    getProfiles(session),
    getTaskTemplates(session),
    getDischargeDraft(session, patientId),
  ]);

  if (!bundle) {
    return <EmptyState title="Patient not found" body="Patient is unavailable in your current scope." />;
  }

  if (bundle.patient.lifecycle === "discharged") {
    redirect(`/discharged/${patientId}`);
  }

  const taskProfiles = await getAssignableProfilesForWard(session, bundle.patient.wardId);
  const defaultTaskOwnerId = taskProfiles.some((profile) => profile.id === session.profile.id)
    ? session.profile.id
    : "";

  const isAssignedWard = session.profile.wardAssignment === bundle.patient.wardId;
  const canManagePatient = session.profile.role === "admin" || session.profile.role === "resident";
  const canEditClinical =
    session.profile.role === "admin" || session.profile.role === "resident" || isAssignedWard;
  const canEditTaskWorkflow =
    session.profile.role === "admin" ||
    session.profile.role === "resident" ||
    (session.profile.role === "student" && isAssignedWard);

  return (
    <div className="space-y-4 md:space-y-5">
      <RealtimeRefresh
        channel={`patient-${patientId}`}
        filters={[
          { schema: "public", table: "patients", filter: `id=eq.${patientId}` },
          { schema: "public", table: "problems", filter: `patient_id=eq.${patientId}` },
          { schema: "public", table: "problem_progress_entries" },
          { schema: "public", table: "ward_tasks", filter: `patient_id=eq.${patientId}` },
          { schema: "public", table: "task_updates" },
          { schema: "public", table: "handover_notes", filter: `patient_id=eq.${patientId}` },
        ]}
      />

      <PageHeader
        className="sticky top-3 z-20"
        compact
        title={`${bundle.patient.displayName} · Bed ${bundle.patient.bed}`}
        subtitle={`${bundle.patient.diagnosis} | Updated ${formatDateTime(bundle.patient.lastUpdate)}`}
        action={
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <Link
              href={`/patients/${bundle.patient.id}/summary-note`}
              className="button-accent inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold"
            >
              Summary Note
            </Link>
            <Link
              href={`/wards/${bundle.patient.wardId}`}
              aria-label="Back to ward"
              title="Back to ward"
              className="button-secondary inline-flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--color-accent-strong)]"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link
              href="/handover"
              aria-label="Open handover"
              title="Open handover"
              className="button-secondary inline-flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--color-accent-strong)]"
            >
              <ClipboardList className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:gap-5 2xl:grid-cols-[1.45fr_0.95fr]">
        <GlassPanel
          title="Problems"
          subtitle="Active problems first. Expand only when you need detail."
          compact
          className="order-2 2xl:order-none 2xl:col-start-1 2xl:row-start-1"
          action={
            canEditClinical ? (
              <ProblemCreator
                iconOnly
                compactTrigger
                buttonLabel="Add problem"
                buttonTitle="Add problem"
                className="mt-0"
                buttonClassName="mt-0"
                panelClassName="mt-0 w-full"
                headerClassName="items-start"
                contentClassName="space-y-3"
              >
                <form action={saveProblemMasterAction} className="space-y-3">
                  <input type="hidden" name="patientId" value={bundle.patient.id} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Problem name">
                      <TextInput name="problemName" required placeholder="Diffuse alveolar hemorrhage" />
                    </Field>
                    <Field label="Priority">
                      <SelectBox name="priority" defaultValue="ACTIVE_STABLE">
                        <option value="ACTIVE_UNSTABLE">Active unstable</option>
                        <option value="ACTIVE_STABLE">Active stable</option>
                        <option value="MONITORING">Monitoring</option>
                        <option value="RESOLVED_CHRONIC">Resolved / chronic</option>
                      </SelectBox>
                    </Field>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Diagnosis status">
                      <SelectBox name="diagnosisStatus" defaultValue="CONFIRMED">
                        <option value="SUSPECTED">Suspected</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="RULED_OUT">Ruled out</option>
                      </SelectBox>
                    </Field>
                    <Field label="Current summary">
                      <TextInput name="currentStatusSummary" placeholder="Stable after PLEX" />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" name="includeInHandover" defaultChecked />
                    Include in handover
                  </label>
                  <div className="flex justify-end">
                    <SubmitButton>Save problem</SubmitButton>
                  </div>
                </form>
              </ProblemCreator>
            ) : null
          }
        >
          <ProblemCards
            problems={bundle.problems}
            tasks={bundle.tasks}
            patientId={bundle.patient.id}
            reorderAction={reorderProblemAction}
            saveProblemMasterAction={saveProblemMasterAction}
            saveProblemProgressEntryAction={saveProblemProgressEntryAction}
            saveTaskAction={saveTaskAction}
            updateStatusAction={updateTaskStatusAction}
            profiles={taskProfiles}
            templates={templates}
            defaultTaskOwnerId={defaultTaskOwnerId}
            canEdit={canEditClinical}
          />
        </GlassPanel>

        <GlassPanel
          title="Patient summary"
          compact
          className="order-1 2xl:order-none 2xl:col-start-2 2xl:row-start-1"
        >
            <SummaryGrid patient={bundle.patient} ward={bundle.ward?.name ?? null} />

            {canManagePatient ? (
              <div className="mt-4 flex flex-wrap items-start gap-3">
                <PatientEditor
                  className="mt-0"
                  buttonClassName="mt-0"
                  panelClassName="mt-0 order-last w-full"
                  headerClassName="items-start"
                  contentClassName="space-y-3"
                >
                  <form action={savePatientDetailAction} className="space-y-3">
                    <input type="hidden" name="id" value={bundle.patient.id} />
                    <input type="hidden" name="wardId" value={bundle.patient.wardId} />
                    <input type="hidden" name="updatedAt" value={bundle.patient.lastUpdate} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Bed">
                        <TextInput name="bed" defaultValue={bundle.patient.bed} required />
                      </Field>
                      <Field label="Display name">
                        <TextInput name="displayName" defaultValue={bundle.patient.displayName} required />
                      </Field>
                    </div>
                    <Field label="Diagnosis">
                      <TextInput name="diagnosis" defaultValue={bundle.patient.diagnosis} required />
                    </Field>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Age">
                        <TextInput
                          name="age"
                          defaultValue={bundle.patient.age != null ? String(bundle.patient.age) : ""}
                        />
                      </Field>
                      <Field label="Sex">
                        <SelectBox name="sex" defaultValue={normalizePatientSexOption(bundle.patient.sex)}>
                          <option value="">Select sex</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </SelectBox>
                      </Field>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Status">
                        <SelectBox name="status" defaultValue={bundle.patient.status}>
                          <option value="stable">Stable</option>
                          <option value="watch">Watch</option>
                          <option value="critical">Critical</option>
                        </SelectBox>
                      </Field>
                      <Field label="Responsible">
                        <SelectBox
                          name="responsibleDoctorId"
                          defaultValue={bundle.patient.responsibleDoctorId ?? ""}
                        >
                          <StaffOptions profiles={profiles} />
                        </SelectBox>
                      </Field>
                      <Field label="Precaution">
                        <SelectBox name="precaution" defaultValue={bundle.patient.precaution}>
                          <option value="none">None</option>
                          <option value="contact">Contact</option>
                          <option value="droplet">Droplet</option>
                          <option value="airborne">Airborne</option>
                        </SelectBox>
                      </Field>
                    </div>
                    <SubmitButton pendingLabel="Updating patient...">Update patient detail</SubmitButton>
                  </form>
                </PatientEditor>

                {bundle.patient.lifecycle === "active" && dischargeDraft ? (
                  <DischargeSummaryEditor
                    className="mt-0"
                    buttonClassName="w-full md:w-auto"
                    panelClassName="mt-0 order-last w-full"
                    headerClassName="items-start"
                    contentClassName="space-y-3"
                  >
                    <form action={dischargePatientWithSummaryAction} className="space-y-3">
                      <input type="hidden" name="patientId" value={bundle.patient.id} />
                      <input type="hidden" name="patientUpdatedAt" value={bundle.patient.lastUpdate} />
                      <div className="grid gap-3 md:grid-cols-3">
                        <SnapshotBox label="Admit date" value={formatDateTime(dischargeDraft.admitDate)} />
                        <SnapshotBox
                          label="Discharge date"
                          value={formatDateTime(dischargeDraft.dischargeDate)}
                        />
                        <SnapshotBox label="Length of stay" value={dischargeDraft.lengthOfStay || "-"} />
                      </div>
                      <Field label="Primary diagnosis">
                        <TextInput
                          name="primaryDiagnosis"
                          defaultValue={dischargeDraft.primaryDiagnosis}
                          required
                        />
                      </Field>
                      <Field label="Hospital course">
                        <TextArea name="hospitalCourse" defaultValue={dischargeDraft.hospitalCourse} />
                      </Field>
                      <Field label="Plan">
                        <TextArea name="plan" defaultValue={dischargeDraft.plan} />
                      </Field>
                      <Field label="Home medication">
                        <TextArea name="homeMedication" defaultValue={dischargeDraft.homeMedication} />
                      </Field>
                      <SubmitButton pendingLabel="Discharging patient...">
                        Confirm discharge
                      </SubmitButton>
                    </form>
                  </DischargeSummaryEditor>
                ) : null}
              </div>
            ) : null}
        </GlassPanel>

        <GlassPanel
          title="Tasks"
          subtitle="Incomplete work first. Mark complete with one tap."
          compact
          className="order-3 2xl:order-none 2xl:col-start-1 2xl:row-start-2"
          action={
            canEditTaskWorkflow ? (
              <TaskCreator
                iconOnly
                compactTrigger
                buttonLabel="Add task"
                buttonTitle="Add task"
                className="mt-0"
                buttonClassName="mt-0"
                panelClassName="mt-0 w-full"
                headerClassName="items-start"
                contentClassName="space-y-3"
              >
                <form action={saveTaskAction} className="space-y-3">
                  <input type="hidden" name="patientId" value={bundle.patient.id} />
                  <Field label="Task title">
                    <TextInput
                      name="title"
                      list="task-template-suggestions"
                      placeholder="Type task title"
                      required
                    />
                  </Field>
                  <datalist id="task-template-suggestions">
                    {templates.map((template) => (
                      <option key={template.id} value={template.title} />
                    ))}
                  </datalist>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Problem link">
                      <SelectBox name="problemId" defaultValue="">
                        <option value="">No linked problem</option>
                        {bundle.problems.map((problem) => (
                          <option key={problem.id} value={problem.id}>
                            {problem.problemName}
                          </option>
                        ))}
                      </SelectBox>
                    </Field>
                    <Field label="Owner">
                      <SelectBox name="ownerId" defaultValue={defaultTaskOwnerId}>
                        <StaffOptions profiles={taskProfiles} />
                      </SelectBox>
                    </Field>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Status">
                      <SelectBox name="status" defaultValue="not_started">
                        <option value="not_started">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                        <option value="blocked">Blocked</option>
                      </SelectBox>
                    </Field>
                    <Field label="Priority">
                      <SelectBox name="priority" defaultValue="normal">
                        <option value="normal">Normal</option>
                        <option value="urgent">Urgent</option>
                        <option value="emergency">Emergency</option>
                      </SelectBox>
                    </Field>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Type">
                      <SelectBox name="type" defaultValue="other">
                        <option value="lab">lab</option>
                        <option value="imaging">imaging</option>
                        <option value="consult">consult</option>
                        <option value="procedure">procedure</option>
                        <option value="family_talk">Family talk</option>
                        <option value="discharge">Discharge</option>
                        <option value="medication">Medication</option>
                        <option value="other">Other</option>
                      </SelectBox>
                    </Field>
                  </div>
                  <Field label="Note">
                    <TextArea name="note" placeholder="Escalate if resistant organism" />
                  </Field>
                  <Field label="Blocked reason">
                    <TextArea name="blockedReason" placeholder="Only when blocked" />
                  </Field>
                  <div className="flex justify-end">
                    <SubmitButton>Create task</SubmitButton>
                  </div>
                </form>
              </TaskCreator>
            ) : null
          }
        >
          <TaskCards
            tasks={bundle.tasks}
            patient={bundle.patient}
            problems={bundle.problems}
            updateStatusAction={updateTaskStatusAction}
            saveTaskAction={saveTaskAction}
            saveTaskUpdateAction={saveTaskUpdateAction}
            profiles={taskProfiles}
            canEdit={canEditTaskWorkflow}
          />
        </GlassPanel>

        {canEditClinical ? (
          <GlassPanel
            title="Manual handover note"
            compact
            className="order-4 2xl:order-none 2xl:col-start-2 2xl:row-start-2"
          >
            <form action={saveHandoverAction} className="space-y-3">
              <input type="hidden" name="patientId" value={bundle.patient.id} />
              <input type="hidden" name="updatedAt" value={bundle.handover?.updatedAt ?? ""} />
              <Field label="Short note">
                <TextArea
                  name="note"
                  defaultValue={bundle.handover?.note ?? ""}
                  placeholder="High risk for respiratory deterioration overnight."
                />
              </Field>
              <Field label="Observe instruction">
                <TextArea
                  name="escalationInstruction"
                  defaultValue={bundle.handover?.escalationInstruction ?? ""}
                  placeholder="Call IM resident if sat < 92% despite 5L O2"
                />
              </Field>
              <SubmitButton>Save handover</SubmitButton>
            </form>
          </GlassPanel>
        ) : null}
      </div>

      <GlassPanel title="Activity timeline" compact>
        <Timeline items={bundle.activity} />
      </GlassPanel>
    </div>
  );
}

function SnapshotBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-subtle rounded-[16px] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
