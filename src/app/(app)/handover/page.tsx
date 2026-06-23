import Link from "next/link";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import {
  EmptyState,
  ExpandableFilters,
  Field,
  GlassPanel,
  HandoverCards,
  HandoverTextPanel,
  SelectBox,
  SetupNotice,
  SubmitButton,
} from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getHandoverBundles, getHandoverStructuredText } from "@/lib/wardflow";

export default async function HandoverPage({
  searchParams,
}: {
  searchParams: Promise<{ wardId?: string }>;
}) {
  const session = await requireAppSession();
  const { wardId } = await searchParams;
  const bundles = await getHandoverBundles(session);
  const selectedBundles = wardId ? bundles.filter((bundle) => bundle.ward.id === wardId) : bundles;
  const structuredText = await getHandoverStructuredText(session, wardId);
  const selectedWardName =
    selectedBundles.length === 1 ? selectedBundles[0].ward.name : "All visible wards";

  const patientCount = selectedBundles.reduce((total, bundle) => total + bundle.patients.length, 0);
  const taskCount = selectedBundles.reduce(
    (total, bundle) => total + bundle.patients.reduce((sum, patient) => sum + patient.tasks.length, 0),
    0,
  );

  return (
    <div className="space-y-6">
      <RealtimeRefresh
        channel="handover-live"
        filters={[
          { schema: "public", table: "patients" },
          { schema: "public", table: "problems" },
          { schema: "public", table: "ward_tasks" },
          { schema: "public", table: "handover_notes" },
        ]}
      />

      <GlassPanel
        headingLevel={1}
        title="Handover mode"
        subtitle="Brief by exception: watch items, pending work, and clear observe instructions."
        action={
          <Link
            href="/handover/tasks"
            className="button-secondary inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold"
          >
            Pending task handover
          </Link>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          <MetricTile label="Visible wards" value={String(selectedBundles.length)} />
          <MetricTile label="Patients in brief" value={String(patientCount)} />
          <MetricTile label="Pending tasks" value={String(taskCount)} />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <ExpandableFilters title="Filter handover" className="mb-0 h-fit">
            <form className="grid gap-3">
              <Field label="Ward">
                <SelectBox name="wardId" defaultValue={wardId ?? ""}>
                  <option value="">All wards</option>
                  {bundles.map((bundle) => (
                    <option key={bundle.ward.id} value={bundle.ward.id}>
                      {bundle.ward.name}
                    </option>
                  ))}
                </SelectBox>
              </Field>
              <SubmitButton>Apply ward filter</SubmitButton>
            </form>
          </ExpandableFilters>

          {session.profile.role === "student" && !session.profile.wardAssignment ? (
            <SetupNotice title="Student ward assignment required" body="รอ admin assign ward ก่อน" />
          ) : null}
        </div>
      </GlassPanel>

      {selectedBundles.length ? (
        <div className="grid gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
          <GlassPanel title="Live handover board" subtitle={selectedWardName}>
            <HandoverCards bundles={selectedBundles} />
          </GlassPanel>

          {structuredText ? (
            <HandoverTextPanel text={structuredText} wardName={selectedWardName} />
          ) : null}
        </div>
      ) : (
        <EmptyState title="Nothing to hand over" body="ยังไม่มีรายการใน scope นี้" />
      )}
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
