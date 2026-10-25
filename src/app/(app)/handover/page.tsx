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
  const awaitingWardAssignment =
    session.profile.role === "resident"
      ? session.profile.residentWardIds.length === 0
      : session.profile.role === "student" && !session.profile.wardAssignment;

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
        title="Handover"

        compact
        action={
          <Link
            href="/handover/tasks"
            className="button-secondary inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold"
          >
            Pending work
          </Link>
        }
      >
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <MetricTile label="Wards" value={String(selectedBundles.length)} />
          <MetricTile label="Patients" value={String(patientCount)} />
          <MetricTile label="Pending" value={String(taskCount)} />
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
          <ExpandableFilters title="Ward" className="mb-0 h-fit">
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
              <SubmitButton>Apply</SubmitButton>
            </form>
          </ExpandableFilters>

          {awaitingWardAssignment ? (
            <SetupNotice title="Ward assignment required" body="Ask an admin to assign one or more Wards before handover items can be shown." />
          ) : null}
        </div>
      </GlassPanel>

      {selectedBundles.length ? (
        <div className="grid gap-4 2xl:grid-cols-[1.2fr_0.8fr]">
          <GlassPanel title="Patients" subtitle={selectedWardName} compact>
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
    <div className="flex items-baseline gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}
