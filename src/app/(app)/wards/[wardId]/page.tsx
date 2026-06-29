import Link from "next/link";
import { EmptyState, PageHeader, PatientCensus } from "@/components/wardflow-ui";
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
    return <EmptyState title="Ward not found" body="Unavailable in your current scope." />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={detail.ward.name}
        action={
          <Link href="/handover" className="button-accent rounded-full px-4 py-2 text-sm font-semibold">
            Open handover mode
          </Link>
        }
      />
      <PatientCensus summaries={[detail]} />
    </div>
  );
}
