import { EmptyState, GlassPanel, PatientCensus } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getDischargedSummaries } from "@/lib/wardflow";

export default async function DischargedPage() {
  const session = await requireAppSession();
  const summaries = await getDischargedSummaries(session);

  return (
    <div className="space-y-6">
      <GlassPanel
        title="Discharged patients"
        subtitle="Once a patient is discharged, the card moves here and leaves the active ward board."
      >
        {summaries.some((summary) => summary.patients.length > 0) ? (
          <PatientCensus summaries={summaries} />
        ) : (
          <EmptyState
            title="No discharged patients yet"
            body="Discharged patients will appear here automatically after a Residence or Admin user discharges them."
          />
        )}
      </GlassPanel>
    </div>
  );
}
