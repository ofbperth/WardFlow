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
        title="Handover mode"
        subtitle="เลือกวอร์ด แล้วคัดลอกข้อความ structured text ไปส่งต่อได้ทันที"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <ExpandableFilters title="Filter handover" className="w-full md:max-w-sm">
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

          <Link
            href="/handover/tasks"
            className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-foreground"
          >
            Pending task handover
          </Link>
        </div>

        {session.profile.role === "student" && !session.profile.wardAssignment ? (
          <div className="mb-5">
            <SetupNotice
              title="Student ward assignment required"
              body="รอ admin assign ward ให้ก่อน จึงจะเห็น handover ได้"
            />
          </div>
        ) : null}

        {selectedBundles.length ? (
          <HandoverCards bundles={selectedBundles} />
        ) : (
          <EmptyState
            title="Nothing to hand over"
            body="อาจยังไม่มีข้อมูลในวอร์ดที่เลือก หรือยังไม่มีผู้ป่วยที่ต้องส่งต่อ"
          />
        )}
      </GlassPanel>

      {structuredText ? <HandoverTextPanel text={structuredText} wardName={selectedWardName} /> : null}
    </div>
  );
}
