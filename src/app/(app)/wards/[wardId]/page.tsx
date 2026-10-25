import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { EmptyState, PageHeader, PatientCensus } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getWardDetail, getAssignableProfilesForWard } from "@/lib/wardflow";
import { WardWorkShortcut } from "@/components/ward-work-shortcut";
import { isProfileAssignableToWard } from "@/lib/resident-ward-assignment";

export default async function WardDetailPage({
  params,
}: {
  params: Promise<{ wardId: string }>;
}) {
  const session = await requireAppSession();
  const { wardId } = await params;
  const detail = await getWardDetail(session, wardId);

  if (!detail) {
    return <EmptyState title="Ward not found" body="Unavailable in your current scope." />;
  }
  const profiles = await getAssignableProfilesForWard(session, wardId);

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        compact
        title={detail.ward.name}
        action={
          <Link
            href="/handover"
            aria-label="Open handover mode"
            title="Open handover mode"
            className="button-secondary inline-flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--color-accent-strong)]"
          >
            <ClipboardList className="h-4 w-4" />
          </Link>
        }
      />
      <PatientCensus summaries={[detail]} renderPatientAction={(patient, ward) =>
        isProfileAssignableToWard(session.profile, ward.id) ?
          <WardWorkShortcut patientId={patient.id} patientName={patient.displayName} bed={patient.bed}
            wardName={ward.name} profiles={profiles}
            defaultOwnerId={profiles.some((profile) => profile.id === session.profile.id) ? session.profile.id : ""} /> : null
      } />
    </div>
  );
}
