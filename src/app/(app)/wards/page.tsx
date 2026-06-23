import Link from "next/link";
import { savePatientWardAction } from "@/app/actions";
import { AppFeedbackToast } from "@/components/app-feedback-toast";
import { AdmitPatientCreator } from "@/components/form-feedback";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import {
  EmptyState,
  Field,
  GlassPanel,
  PageHeader,
  PatientCensus,
  SectionLabel,
  SelectBox,
  SetupNotice,
  StaffOptions,
  SubmitButton,
  TextInput,
} from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getWardOverviewData } from "@/lib/wardflow";

export default async function WardsPage({
  searchParams,
}: {
  searchParams?: Promise<{ toast?: string; error?: string }>;
}) {
  const { toast, error } = (await searchParams) ?? {};
  const sessionPromise = requireAppSession();
  const overviewPromise = sessionPromise.then((session) => getWardOverviewData(session));
  const [session, { summaries, profiles }] = await Promise.all([sessionPromise, overviewPromise]);

  const canManagePatient = session.profile.role === "admin" || session.profile.role === "resident";
  const admitWardIds =
    session.profile.role === "admin" || session.profile.role === "resident"
      ? summaries.map((summary) => summary.ward.id)
      : [session.profile.wardAssignment].filter(Boolean);
  const singleVisibleWardId = summaries.length === 1 ? summaries[0]?.ward.id ?? null : null;
  const wardFilter =
    session.profile.role === "student" && session.profile.wardAssignment
      ? `id=eq.${session.profile.wardAssignment}`
      : singleVisibleWardId
        ? `id=eq.${singleVisibleWardId}`
        : undefined;
  const patientFilter =
    session.profile.role === "student" && session.profile.wardAssignment
      ? `ward_id=eq.${session.profile.wardAssignment}`
      : undefined;
  const admitEligibleSummaries = summaries.filter((summary) => admitWardIds.includes(summary.ward.id));

  return (
    <div className="space-y-4 md:space-y-6">
      <AppFeedbackToast toastKey={toast} />
      <RealtimeRefresh
        channel="wards-live"
        filters={[
          { schema: "public", table: "wards", filter: wardFilter },
          { schema: "public", table: "patients", filter: patientFilter },
          { schema: "public", table: "ward_tasks" },
          { schema: "public", table: "problems" },
          { schema: "public", table: "handover_notes" },
        ]}
      />

      <PageHeader
        title="Ward overview"
        subtitle="Scan every ward quickly, spot key status at a glance, and jump into the patient workspace without extra steps."
        action={
          <Link
            href="/discharged"
            className="inline-flex w-full items-center justify-center rounded-full border clinical-divider bg-white px-4 py-2.5 text-sm font-semibold text-foreground md:w-auto"
          >
            Discharged
          </Link>
        }
      />

      {session.profile.role === "student" && !session.profile.wardAssignment ? (
        <SetupNotice
          title="Student ward assignment required"
          body="Wait for an admin to assign a ward before ward data becomes visible here."
        />
      ) : null}

      {error === "patient-save-failed" ? (
        <SetupNotice
          title="Unable to admit patient"
          body="The admit could not be saved. Check the selected ward and this account's permission, then try again."
        />
      ) : null}

      {summaries.length ? (
        <PatientCensus
          summaries={summaries}
          renderWardFooter={
            canManagePatient
              ? (summary) => (
                  <AdmitPatientCreator
                    className="mt-0 w-full rounded-[22px] bg-mint-50/80"
                    buttonClassName="mt-0 ml-auto"
                    panelClassName="mt-0 w-full"
                    headerClassName="items-start"
                    contentClassName="space-y-3"
                  >
                    <SectionLabel>New patient</SectionLabel>
                    <form action={savePatientWardAction} className="space-y-3">
                      <input type="hidden" name="wardId" value={summary.ward.id} />
                      {admitEligibleSummaries.length > 1 ? (
                        <Field label="Ward">
                          <SelectBox name="wardId" defaultValue={summary.ward.id}>
                            {admitEligibleSummaries.map((item) => (
                              <option key={item.ward.id} value={item.ward.id}>
                                {item.ward.name}
                              </option>
                            ))}
                          </SelectBox>
                        </Field>
                      ) : null}
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <Field label="Bed">
                          <TextInput name="bed" placeholder="12" required />
                        </Field>
                        <Field label="Display name" className="md:col-span-2">
                          <TextInput name="displayName" placeholder="S. Woranit" required />
                        </Field>
                      </div>
                      <Field label="Diagnosis">
                        <TextInput name="diagnosis" placeholder="Pneumonia with AKI" required />
                      </Field>
                      <div className="grid gap-3 md:grid-cols-3">
                        <Field label="Precaution">
                          <SelectBox name="precaution" defaultValue="none">
                            <option value="none">None</option>
                            <option value="contact">Contact</option>
                            <option value="droplet">Droplet</option>
                            <option value="airborne">Airborne</option>
                          </SelectBox>
                        </Field>
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
                      <div className="flex justify-end">
                        <SubmitButton>Admit patient</SubmitButton>
                      </div>
                    </form>
                  </AdmitPatientCreator>
                )
              : undefined
          }
        />
      ) : (
        <EmptyState
          title="No wards visible yet"
          body="Create a ward in admin or assign this user into a ward first."
        />
      )}

      {!canManagePatient ? (
        <GlassPanel
          title="Student access"
          subtitle="Students can add tasks, problem lists, and handover updates from the patient page."
          className="h-fit"
        >
          <p className="text-sm leading-6 text-muted">
            Admitting and discharging patients remains limited to Resident and Admin roles.
          </p>
        </GlassPanel>
      ) : null}
    </div>
  );
}
