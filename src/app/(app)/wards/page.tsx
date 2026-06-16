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
import Link from "next/link";

export default async function WardsPage() {
  const session = await requireAppSession();
  const canManagePatient = session.profile.role === "admin" || session.profile.role === "resident";
  const [summaries, profiles] = await Promise.all([
    getWardSummaries(session),
    getProfiles(session),
  ]);

  return (
    <div className="space-y-6">
      <GlassPanel
        title="Ward Census"
        subtitle="Minimal, live, and patient-centered. Filter-friendly structure without dense tables."
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
                body="Create the first ward in admin, or assign your profile to a ward."
              />
            )}
          </div>

          <div className="space-y-4">
            {canManagePatient ? (
              <GlassPanel
                title="Quick admit"
                subtitle="Fast create patient flow for ward intake."
                className="h-fit"
              >
                <SectionLabel>New patient</SectionLabel>
                <form action={savePatientAction} className="space-y-3">
                  <Field label="Ward">
                    <SelectBox name="wardId" defaultValue={session.profile.wardAssignment ?? ""}>
                      <option value="" disabled>
                        Select ward
                      </option>
                      {summaries.map((summary) => (
                        <option key={summary.ward.id} value={summary.ward.id}>
                          {summary.ward.name}
                        </option>
                      ))}
                    </SelectBox>
                  </Field>
                  <Field label="Bed">
                    <TextInput name="bed" placeholder="12" required />
                  </Field>
                  <Field label="Patient display name">
                    <TextInput name="displayName" placeholder="S. Woranit" required />
                  </Field>
                  <Field label="Diagnosis">
                    <TextInput name="diagnosis" placeholder="Pneumonia with AKI" required />
                  </Field>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Status">
                      <SelectBox name="status" defaultValue="stable">
                        <option value="stable">stable</option>
                        <option value="watch">watch</option>
                        <option value="critical">critical</option>
                      </SelectBox>
                    </Field>
                    <Field label="Responsible">
                      <SelectBox name="responsibleDoctorId" defaultValue={session.profile.id}>
                        <StaffOptions profiles={profiles} />
                      </SelectBox>
                    </Field>
                  </div>
                  <SubmitButton>Create patient</SubmitButton>
                </form>
              </GlassPanel>
            ) : (
              <GlassPanel
                title="Student access"
                subtitle="Students can create tasks, problem lists, save handover, and edit those entries on the patient card."
                className="h-fit"
              >
                <p className="text-sm leading-6 text-muted">
                  Patient admission and discharge stay with Residence and Admin roles.
                </p>
              </GlassPanel>
            )}
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
