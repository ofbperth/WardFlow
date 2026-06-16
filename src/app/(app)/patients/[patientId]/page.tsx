import {
  dischargePatientAction,
  reorderProblemAction,
  saveHandoverAction,
  savePatientAction,
  saveProblemAction,
  saveTaskAction,
  updateTaskStatusAction,
} from "@/app/actions";
import {
  PatientEditor,
  PendingSubmitButton,
  ProblemCreator,
  TaskCreator,
} from "@/components/form-feedback";
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
import { formatDateTime } from "@/lib/utils";
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
        body="ไม่พบข้อมูลผู้ป่วยรายนี้ หรือคุณไม่มีสิทธิ์เข้าถึงวอร์ดนี้"
      />
    );
  }

  const canManagePatient = session.profile.role === "admin" || session.profile.role === "resident";
  const canEditClinical = canManagePatient || session.profile.role === "student";

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
        title={`${bundle.patient.displayName} | Bed ${bundle.patient.bed}`}
        subtitle={`อัปเดตล่าสุด ${formatDateTime(bundle.patient.lastUpdate)}`}
        action={
          canManagePatient && bundle.patient.lifecycle === "active" ? (
            <form action={dischargePatientAction}>
              <input type="hidden" name="patientId" value={bundle.patient.id} />
              <PendingSubmitButton
                pendingLabel="กำลังจำหน่ายผู้ป่วย..."
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
              >
                จำหน่ายผู้ป่วย
              </PendingSubmitButton>
            </form>
          ) : null
        }
      >
        <SummaryGrid patient={bundle.patient} ward={bundle.ward?.name ?? null} />
        {canEditClinical ? (
          <PatientEditor>
            <form action={savePatientAction} className="space-y-3">
              <input type="hidden" name="id" value={bundle.patient.id} />
              <input type="hidden" name="wardId" value={bundle.patient.wardId} />
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
        ) : null}
      </GlassPanel>

      <div className="grid gap-6 2xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-6">
          <GlassPanel title="Problem list" subtitle="รายการที่ resolved แล้วจะถูกพับไว้ให้อ่านหน้าง่าย">
            <ProblemCards
              problems={bundle.problems}
              patientId={bundle.patient.id}
              reorderAction={reorderProblemAction}
              saveProblemAction={saveProblemAction}
              canEdit={canEditClinical}
            />
          </GlassPanel>

          <GlassPanel title="Task board" subtitle="งานที่ทำเสร็จจะย้ายไปส่วน archive อัตโนมัติ">
            <TaskCards
              tasks={bundle.tasks}
              patient={bundle.patient}
              updateStatusAction={updateTaskStatusAction}
              saveTaskAction={saveTaskAction}
              profiles={profiles}
              canEdit={canEditClinical}
            />
          </GlassPanel>
        </div>

        <div className="space-y-6">
          {canEditClinical ? (
            <GlassPanel title="Add problem" subtitle="บันทึกข้อมูลแบบสั้น ชัด และใช้ต่อใน handover ได้">
              <SectionLabel>Problem</SectionLabel>
              <ProblemCreator>
                <form action={saveProblemAction} className="space-y-3">
                  <input type="hidden" name="patientId" value={bundle.patient.id} />
                  <Field label="หัวข้อ">
                    <TextInput name="title" required placeholder="Hypoxemia overnight" />
                  </Field>
                  <Field label="สถานะ">
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
                  <Field label="แผน">
                    <TextArea name="plan" placeholder="Repeat CXR and monitor saturation trend" />
                  </Field>
                  <Field label="สิ่งที่ค้าง">
                    <TextArea name="pending" placeholder="Await ABG" />
                  </Field>
                  <Field label="เฝ้าระวัง">
                    <TextArea name="watchOut" placeholder="Desaturation during transfer" />
                  </Field>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" name="includeInHandover" defaultChecked />
                    รวมใน handover
                  </label>
                  <SubmitButton>บันทึก problem</SubmitButton>
                </form>
              </ProblemCreator>
            </GlassPanel>
          ) : null}

          {canEditClinical ? (
            <GlassPanel title="Create task" subtitle="กำหนด owner, priority และเวลาให้ชัดตั้งแต่ตอนสร้าง">
              <TaskCreator>
                <form action={saveTaskAction} className="space-y-3">
                  <input type="hidden" name="patientId" value={bundle.patient.id} />
                  <Field label="ชื่องาน">
                    <SelectBox name="title" defaultValue="" required>
                      <option value="" disabled>
                        เลือก task ที่ต้องการ
                      </option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.title}>
                          {template.title}
                        </option>
                      ))}
                    </SelectBox>
                  </Field>
                  <Field label="ผู้รับผิดชอบ">
                    <SelectBox name="ownerId" defaultValue={session.profile.id}>
                      <StaffOptions profiles={profiles} />
                    </SelectBox>
                  </Field>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="สถานะ">
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
                        <option value="urgency">Urgency</option>
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
                    <Field label="เวลาที่ต้องเสร็จ">
                      <TextInput name="dueAt" type="datetime-local" />
                    </Field>
                  </div>
                  <Field label="โน้ต">
                    <TextArea name="note" placeholder="Escalate if resistant organism" />
                  </Field>
                  <Field label="สาเหตุที่ติดปัญหา">
                    <TextArea name="blockedReason" placeholder="กรอกเมื่อ task ติดปัญหา" />
                  </Field>
                  <SubmitButton>บันทึก task</SubmitButton>
                </form>
              </TaskCreator>
            </GlassPanel>
          ) : null}

          {canEditClinical ? (
            <GlassPanel title="Manual handover note" subtitle="เพิ่ม short note และคำสั่ง escalation เพิ่มเติมได้">
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
                <SubmitButton>บันทึก handover</SubmitButton>
              </form>
            </GlassPanel>
          ) : null}
        </div>
      </div>

      <GlassPanel
        title="Activity timeline"
        subtitle="แสดงรายการเปลี่ยนแปลงล่าสุดก่อน และกดขยายได้เมื่ออยากดูย้อนหลังเพิ่ม"
      >
        <Timeline items={bundle.activity} />
      </GlassPanel>
    </div>
  );
}
