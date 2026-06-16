import Link from "next/link";
import { savePatientAction } from "@/app/actions";
import {
  EmptyState,
  Field,
  GlassPanel,
  PatientCensus,
  SectionLabel,
  SelectBox,
  StaffOptions,
  SubmitButton,
  TextInput,
} from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getProfiles, getWardSummaries } from "@/lib/wardflow";

export default async function WardsPage() {
  const session = await requireAppSession();
  const canManagePatient = session.profile.role === "admin" || session.profile.role === "resident";
  const [summaries, profiles] = await Promise.all([getWardSummaries(session), getProfiles(session)]);

  return (
    <div className="space-y-6">
      <GlassPanel
        title="Ward overview"
        subtitle="ดูผู้ป่วยทั้งหมดในวอร์ดแบบอ่านง่าย อัปเดตไว และไม่ต้องไล่กระดาษ"
        action={
          <Link
            href="/discharged"
            className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-foreground"
          >
            Discharged patients
          </Link>
        }
      >
        <div className="grid gap-6 2xl:grid-cols-[1.7fr_0.9fr]">
          <div>
            {summaries.length ? (
              <PatientCensus summaries={summaries} />
            ) : (
              <EmptyState
                title="No wards visible yet"
                body="สร้างวอร์ดในหน้า admin หรือ assign user นี้เข้าวอร์ดก่อน"
              />
            )}
          </div>

          <div className="space-y-4">
            {canManagePatient ? (
              <GlassPanel
                title="Admit patient"
                subtitle="เพิ่มผู้ป่วยใหม่เข้าวอร์ดจากหน้านี้ได้ทันที"
                className="h-fit"
              >
                <SectionLabel>New patient</SectionLabel>
                <form action={savePatientAction} className="space-y-3">
                  <Field label="Ward">
                    <SelectBox name="wardId" defaultValue={session.profile.wardAssignment ?? ""}>
                      <option value="" disabled>
                        เลือกวอร์ด
                      </option>
                      {summaries.map((summary) => (
                        <option key={summary.ward.id} value={summary.ward.id}>
                          {summary.ward.name}
                        </option>
                      ))}
                    </SelectBox>
                  </Field>
                  <Field label="เตียง">
                    <TextInput name="bed" placeholder="12" required />
                  </Field>
                  <Field label="ชื่อที่ใช้แสดง">
                    <TextInput name="displayName" placeholder="S. Woranit" required />
                  </Field>
                  <Field label="Diagnosis">
                    <TextInput name="diagnosis" placeholder="Pneumonia with AKI" required />
                  </Field>
                  <Field label="Precaution">
                    <SelectBox name="precaution" defaultValue="none">
                      <option value="none">None</option>
                      <option value="contact">Contact</option>
                      <option value="droplet">Droplet</option>
                      <option value="airborne">Airborne</option>
                    </SelectBox>
                  </Field>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Status">
                      <SelectBox name="status" defaultValue="stable">
                        <option value="stable">Stable</option>
                        <option value="watch">Watch</option>
                        <option value="critical">Critical</option>
                      </SelectBox>
                    </Field>
                    <Field label="Responsible">
                      <SelectBox name="responsibleDoctorId" defaultValue={session.profile.id}>
                        <StaffOptions profiles={profiles} />
                      </SelectBox>
                    </Field>
                  </div>
                  <SubmitButton>Admit patient</SubmitButton>
                </form>
              </GlassPanel>
            ) : (
              <GlassPanel
                title="Student access"
                subtitle="Student เพิ่ม task, problem list, handover และแก้ไขรายการเหล่านี้ได้จากหน้า patient"
                className="h-fit"
              >
                <p className="text-sm leading-6 text-muted">
                  การรับผู้ป่วยเข้าและการจำหน่ายผู้ป่วย จะทำได้เฉพาะ Resident และ Admin
                </p>
              </GlassPanel>
            )}
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
