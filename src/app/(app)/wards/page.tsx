import Link from "next/link";
import { Archive } from "lucide-react";
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
import { normalizePatientSexOption } from "@/lib/utils";
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
        compact
        title="Ward overview"
        action={
          <Link
            href="/discharged"
            aria-label="Open discharged patients"
            title="Open discharged patients"
            className="button-secondary inline-flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--color-accent-strong)]"
          >
            <Archive className="h-4 w-4" />
          </Link>
        }
      />

      {session.profile.role === "student" && !session.profile.wardAssignment ? (
        <SetupNotice title="Student ward assignment required" body="Ask admin to assign your ward." />
      ) : null}

      {error === "patient-save-failed" ? (
        <SetupNotice title="Unable to admit patient" body="Check ward access and try again." />
      ) : null}

      {summaries.length ? (
        <PatientCensus
          summaries={summaries}
          renderWardFooter={
            canManagePatient
              ? (summary) => (
                  <AdmitPatientCreator
                    className="panel-accent mt-0 w-full rounded-[18px]"
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
                        <Field label="Age">
                          <TextInput name="age" placeholder="71" />
                        </Field>
                        <Field label="Sex">
                          <SelectBox name="sex" defaultValue={normalizePatientSexOption(null)}>
                            <option value="">Select sex</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </SelectBox>
                        </Field>
                        <Field label="Underlying disease">
                          <TextInput name="underlyingDisease" placeholder="DM, HT, CKD" />
                        </Field>
                      </div>
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
        <EmptyState title="No wards visible yet" body="Create a ward or assign this user first." />
      )}

      {!canManagePatient ? (
        <GlassPanel title="Student access" className="h-fit">
          <p className="text-sm leading-6 text-muted">
            Admit and discharge stay limited to Resident and Admin.
          </p>
        </GlassPanel>
      ) : null}
    </div>
  );
}
