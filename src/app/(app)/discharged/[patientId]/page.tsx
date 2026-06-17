import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, GlassPanel } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { getDischargeSummaryByPatientId, getPatientBundle } from "@/lib/wardflow";

export default async function DischargedPatientSummaryPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const session = await requireAppSession();
  const { patientId } = await params;
  const [bundle, payload] = await Promise.all([
    getPatientBundle(session, patientId),
    getDischargeSummaryByPatientId(session, patientId),
  ]);

  if (!bundle) {
    return (
      <EmptyState
        title="Patient not found"
        body="This discharged patient is unavailable or you do not have access to the ward."
      />
    );
  }

  if (bundle.patient.lifecycle !== "discharged") {
    redirect(`/patients/${patientId}`);
  }

  return (
    <div className="space-y-6">
      <GlassPanel
        title={`Discharge summary | ${bundle.patient.displayName}`}
        subtitle={`Bed ${bundle.patient.bed} | ${bundle.ward?.name ?? "-"}`}
        action={
          payload ? (
            <a
              href={`/api/discharge-summaries/${payload.summary.id}`}
              className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-foreground"
            >
              Export Word
            </a>
          ) : (
            <Link
              href="/discharged"
              className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-foreground"
            >
              Back to discharged
            </Link>
          )
        }
      >
        {payload ? (
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryRow label="Ward" value={payload.ward?.name ?? "-"} />
            <SummaryRow label="Bed" value={payload.patient.bed} />
            <SummaryRow label="Admit date" value={formatDateTime(payload.summary.admitDate)} />
            <SummaryRow
              label="Discharge date"
              value={formatDateTime(payload.summary.dischargeDate)}
            />
            <SummaryRow label="Length of stay" value={payload.summary.lengthOfStay || "-"} />
            <SummaryRow
              label="Primary diagnosis"
              value={payload.summary.primaryDiagnosis || "-"}
            />
            <SummaryRow
              label="Hospital course"
              value={payload.summary.hospitalCourse || "-"}
            />
            <SummaryRow label="Plan" value={payload.summary.plan || "-"} />
            <SummaryRow
              label="Home medication"
              value={payload.summary.homeMedication || "-"}
            />
            <SummaryRow label="Created at" value={formatDateTime(payload.summary.createdAt)} />
          </div>
        ) : (
          <EmptyState
            title="No discharge summary yet"
            body="This patient has been discharged, but no discharge summary has been generated for this record."
          />
        )}
      </GlassPanel>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  );
}
