import {
  reorderProblemAction,
  saveHandoverAction,
  saveProblemAction,
  saveTaskAction,
  updateTaskStatusAction,
} from "@/app/actions";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import {
  EmptyState,
  Field,
  GlassPanel,
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
import { getPatientBundle, getProfiles, getTaskTemplates } from "@/lib/wardflow";

export default async function PatientPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const session = await requireAppSession();
  const { patientId } = await params;
  const [bundle, profiles, templates] = await Promise.all([
    getPatientBundle(session, patientId),
    getProfiles(session),
    getTaskTemplates(),
  ]);

  if (!bundle) {
    return (
      <EmptyState
        title="Patient not found"
        body="The requested patient is missing or outside your ward scope."
      />
    );
  }

  return (
    <div className="space-y-6">
      <RealtimeRefresh
        channel={`patient-${patientId}`}
        filters={[
          { schema: "public", table: "patients", filter: `id=eq.${patientId}` },
          { schema: "public", table: "problems", filter: `patient_id=eq.${patientId}` },
          { schema: "public", table: "ward_tasks", filter: `patient_id=eq.${patientId}` },
          { schema: "public", table: "handover_notes", filter: `patient_id=eq.${patientId}` },
        ]}
      />

      <GlassPanel
        title={`${bundle.patient.displayName} · Bed ${bundle.patient.bed}`}
        subtitle={`Updated ${bundle.patient.lastUpdate}`}
      >
        <SummaryGrid patient={bundle.patient} ward={bundle.ward?.name ?? null} />
      </GlassPanel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <GlassPanel title="Problem list" subtitle="Resolved items collapse by default.">
            <ProblemCards
              problems={bundle.problems}
              patientId={bundle.patient.id}
              reorderAction={reorderProblemAction}
            />
          </GlassPanel>

          <GlassPanel title="Task board" subtitle="Realtime patient-centered task management.">
            <TaskCards
              tasks={bundle.tasks}
              patient={bundle.patient}
              updateStatusAction={updateTaskStatusAction}
            />
          </GlassPanel>

          <GlassPanel title="Activity timeline" subtitle='Answer "Who did what and when?" at a glance.'>
            <Timeline items={bundle.activity} />
          </GlassPanel>
        </div>

        <div className="space-y-6">
          <GlassPanel title="Add problem" subtitle="Structured handover-safe problem entry.">
            <SectionLabel>Problem</SectionLabel>
            <form action={saveProblemAction} className="space-y-3">
              <input type="hidden" name="patientId" value={bundle.patient.id} />
              <Field label="Title">
                <TextInput name="title" required placeholder="Hypoxemia overnight" />
              </Field>
              <Field label="Status">
                <SelectBox name="status" defaultValue="active">
                  <option value="active">active</option>
                  <option value="improving">improving</option>
                  <option value="worsening">worsening</option>
                  <option value="resolved">resolved</option>
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
              <SubmitButton>Save problem</SubmitButton>
            </form>
          </GlassPanel>

          <GlassPanel title="Create task" subtitle="Owner, priority, due time, and blocker aware.">
            <form action={saveTaskAction} className="space-y-3">
              <input type="hidden" name="patientId" value={bundle.patient.id} />
              <Field label="Task title">
                <SelectBox name="title" defaultValue="" required>
                  <option value="" disabled>
                    Select task title
                  </option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.title}>
                      {template.title}
                    </option>
                  ))}
                </SelectBox>
              </Field>
              <Field label="Owner">
                <SelectBox name="ownerId" defaultValue={session.profile.id}>
                  <StaffOptions profiles={profiles} />
                </SelectBox>
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Status">
                  <SelectBox name="status" defaultValue="not_started">
                    <option value="not_started">not_started</option>
                    <option value="in_progress">in_progress</option>
                    <option value="waiting">waiting</option>
                    <option value="done">done</option>
                    <option value="blocked">blocked</option>
                  </SelectBox>
                </Field>
                <Field label="Priority">
                  <SelectBox name="priority" defaultValue="normal">
                    <option value="low">low</option>
                    <option value="normal">normal</option>
                    <option value="high">high</option>
                    <option value="urgent">urgent</option>
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
                    <option value="family_talk">family_talk</option>
                    <option value="discharge">discharge</option>
                    <option value="medication">medication</option>
                    <option value="other">other</option>
                  </SelectBox>
                </Field>
                <Field label="Due time">
                  <TextInput name="dueAt" type="datetime-local" />
                </Field>
              </div>
              <Field label="Note">
                <TextArea name="note" placeholder="Escalate if resistant organism" />
              </Field>
              <Field label="Blocked reason">
                <TextArea name="blockedReason" placeholder="Only when blocked" />
              </Field>
              <SubmitButton>Create task</SubmitButton>
            </form>
          </GlassPanel>

          <GlassPanel title="Manual handover note" subtitle="Editable final note.">
            <form action={saveHandoverAction} className="space-y-3">
              <input type="hidden" name="patientId" value={bundle.patient.id} />
              <Field label="Short note">
                <TextArea
                  name="note"
                  defaultValue={bundle.handover?.note ?? ""}
                  placeholder="High risk for respiratory deterioration overnight."
                />
              </Field>
              <Field label="Escalation instruction">
                <TextArea
                  name="escalationInstruction"
                  defaultValue={bundle.handover?.escalationInstruction ?? ""}
                  placeholder="Call IM resident if sat < 92% despite 5L O2"
                />
              </Field>
              <SubmitButton>Save handover</SubmitButton>
            </form>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
