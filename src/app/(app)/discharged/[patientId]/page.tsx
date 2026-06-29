import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, GlassPanel, PageHeader } from "@/components/wardflow-ui";
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
    return <EmptyState title="Patient not found" body="Unavailable in your current scope." />;
  }

  if (bundle.patient.lifecycle !== "discharged") {
    redirect(`/patients/${patientId}`);
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Discharge summary"
        subtitle={bundle.patient.displayName}
        action={
          payload ? (
            <a
              href={`/api/discharge-summaries/${payload.summary.id}`}
              className="button-secondary rounded-full px-4 py-2 text-sm font-semibold"
            >
              Export Word
            </a>
          ) : (
            <Link href="/discharged" className="button-secondary rounded-full px-4 py-2 text-sm font-semibold">
              Back to discharged
            </Link>
          )
        }
      />

      {payload ? (
        <GlassPanel title="Summary details">
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryRow label="Ward" value={payload.ward?.name ?? "-"} />
            <SummaryRow label="Bed" value={payload.patient.bed} />
            <SummaryRow label="Admit date" value={formatDateTime(payload.summary.admitDate)} />
            <SummaryRow label="Discharge date" value={formatDateTime(payload.summary.dischargeDate)} />
            <SummaryRow label="Length of stay" value={payload.summary.lengthOfStay || "-"} />
            <SummaryRow label="Primary diagnosis" value={payload.summary.primaryDiagnosis || "-"} />
            <SummaryRow label="Hospital course" value={payload.summary.hospitalCourse || "-"} />
            <SummaryRow label="Plan" value={payload.summary.plan || "-"} />
            <SummaryRow label="Home medication" value={payload.summary.homeMedication || "-"} />
            <SummaryRow label="Created at" value={formatDateTime(payload.summary.createdAt)} />
          </div>
        </GlassPanel>
      ) : (
        <EmptyState title="No discharge summary yet" />
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-subtle rounded-2xl p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  );
}
