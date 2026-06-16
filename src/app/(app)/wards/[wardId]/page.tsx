import Link from "next/link";
import { EmptyState, GlassPanel, PatientCensus } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getWardDetail } from "@/lib/wardflow";

export default async function WardDetailPage({
  params,
}: {
  params: Promise<{ wardId: string }>;
}) {
  const session = await requireAppSession();
  const { wardId } = await params;
  const detail = await getWardDetail(session, wardId);

  if (!detail) {
    return (
      <EmptyState
        title="Ward not found"
        body="The ward may not exist or is outside your assignment scope."
      />
    );
  }

  return (
    <div className="space-y-6">
      <GlassPanel
        title={detail.ward.name}
        subtitle="Ward-scoped live board for round follow-up and patient drill-down."
        action={
          <Link
            href="/handover"
            className="rounded-full bg-mint-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Open handover mode
          </Link>
        }
      >
        <PatientCensus summaries={[detail]} />
      </GlassPanel>
    </div>
  );
}
