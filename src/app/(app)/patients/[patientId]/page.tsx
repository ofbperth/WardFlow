import Link from "next/link";
import { redirect } from "next/navigation";
import {
  dischargePatientWithSummaryAction,
  reorderProblemAction,
  saveHandoverAction,
  savePatientDetailAction,
  saveProblemAction,
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
  SectionLabel,
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
import { formatDateTime } from "@/lib/utils";
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
    return <EmptyState title="Patient not found" body="ไม่พบข้อมูลหรือไม่มีสิทธิ์เข้าถึง" />;
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
  const activeProblemCount = bundle.problems.filter((problem) => problem.status !== "resolved").length;
  const activeTaskCount = bundle.tasks.filter((task) => task.status !== "done").length;

  return (
    <div className="space-y-4 md:space-y-6">
      <RealtimeRefresh
        channel={`patient-${patientId}`}
        filters={[
          { schema: "public", table: "patients", filter: `id=eq.${patientId}` },
          { schema: "public", table: "problems", filter: `patient_id=eq.${patientId}` },
          { schema: "public", table: "ward_tasks", filter: `patient_id=eq.${patientId}` },
          { schema: "public", table: "task_updates" },
          { schema: "public", table: "handover_notes", filter: `patient_id=eq.${patientId}` },
        ]}
      />

      <PageHeader
        title={`${bundle.patient.displayName} · Bed ${bundle.patient.bed}`}
        subtitle={`Updated ${formatDateTime(bundle.patient.lastUpdate)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/wards/${bundle.patient.wardId}`}
              className="button-secondary inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold"
            >
              Back to ward
            </Link>
            <Link
              href="/handover"
              className="button-secondary inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold"
            >
              Open handover
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Clinical status" value={bundle.patient.status} />
        <MetricCard label="Open problems" value={String(activeProblemCount)} />
        <MetricCard label="Active tasks" value={String(activeTaskCount)} />
        <MetricCard
          label="Responsible"
          value={bundle.patient.responsibleDoctorName ?? "Unassigned"}
        />
      </section>

      <GlassPanel title="Patient summary" className="px-4 py-4 md:px-6 md:py-6">
        <SummaryGrid patient={bundle.patient} ward={bundle.ward?.name ?? null} />

        {canManagePatient ? (
          <div className="mt-4 flex flex-wrap items-start gap-3 md:mt-5">
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

      <div className="grid gap-4 md:gap-6 2xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-4 md:space-y-6">
          <GlassPanel title="Problem list">
            <ProblemCards
              problems={bundle.problems}
              patientId={bundle.patient.id}
              reorderAction={reorderProblemAction}
              saveProblemAction={saveProblemAction}
              canEdit={canEditClinical}
            />
            {canEditClinical ? (
              <div className="mt-4 border-t clinical-divider pt-4">
                <ProblemCreator
                  className="panel-accent mt-0 w-full rounded-[22px]"
                  buttonClassName="mt-0 ml-auto"
                  panelClassName="mt-0 w-full"
                  headerClassName="items-start"
                  contentClassName="space-y-3"
                >
                  <SectionLabel>Problem</SectionLabel>
                  <form action={saveProblemAction} className="space-y-3">
                    <input type="hidden" name="patientId" value={bundle.patient.id} />
                    <Field label="Title">
                      <TextInput name="title" required placeholder="Hypoxemia overnight" />
                    </Field>
                    <Field label="Status">
                      <SelectBox name="status" defaultValue="active">
                        <option value="active">Active</option>
                        <option value="improving">Improving</option>
                        <option value="worsening">Worsening</option>
                        <option value="resolved">Resolved</option>
                      </SelectBox>
                    </Field>
                    <Field label="Key data">
                      <TextArea name="keyData" placeholder="O2 requirement up to 5L/min" />
                    </Field>
                    <Field label="Plan">
                      <TextArea name="plan" placeholder="Repeat CXR and monitor saturation trend" />
                    </Field>
                    <Field label="Pending">
                      <TextArea name="pending" placeholder="Await ABG" />
                    </Field>
                    <Field label="Watch out">
                      <TextArea name="watchOut" placeholder="Desaturation during transfer" />
                    </Field>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" name="includeInHandover" defaultChecked />
                      Include in handover
                    </label>
                    <div className="flex justify-end">
                      <SubmitButton>Save problem</SubmitButton>
                    </div>
                  </form>
                </ProblemCreator>
              </div>
            ) : null}
          </GlassPanel>

          <GlassPanel title="Task board">
            <TaskCards
              tasks={bundle.tasks}
              patient={bundle.patient}
              updateStatusAction={updateTaskStatusAction}
              saveTaskAction={saveTaskAction}
              saveTaskUpdateAction={saveTaskUpdateAction}
              profiles={taskProfiles}
              canEdit={canEditTaskWorkflow}
            />
            {canEditTaskWorkflow ? (
              <div className="mt-4 border-t clinical-divider pt-4">
                <TaskCreator
                  className="panel-accent mt-0 w-full rounded-[22px]"
                  buttonClassName="mt-0 ml-auto"
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
                    <Field label="Owner">
                      <SelectBox name="ownerId" defaultValue={defaultTaskOwnerId}>
                        <StaffOptions profiles={taskProfiles} />
                      </SelectBox>
                    </Field>
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
                        <SelectBox name="type" defaultValue="lab">
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
              </div>
            ) : null}
          </GlassPanel>
        </div>

        <div className="space-y-4 md:space-y-6">
          <GlassPanel title="Care snapshot">
            <div className="grid gap-3 sm:grid-cols-2">
              <SnapshotBox label="Code status" value={bundle.patient.codeStatus ?? "-"} />
              <SnapshotBox label="Precaution" value={bundle.patient.precaution ?? "-"} />
              <SnapshotBox label="Allergy" value={bundle.patient.allergy ?? "-"} />
              <SnapshotBox label="Ward" value={bundle.ward?.name ?? "-"} />
            </div>
          </GlassPanel>

          {canEditClinical ? (
            <GlassPanel title="Manual handover note">
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
      </div>

      <GlassPanel title="Activity timeline">
        <Timeline items={bundle.activity} />
      </GlassPanel>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SnapshotBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-subtle rounded-[20px] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
