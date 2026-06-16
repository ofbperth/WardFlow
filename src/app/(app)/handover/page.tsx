import { RealtimeRefresh } from "@/components/realtime-refresh";
import { EmptyState, GlassPanel, HandoverCards } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getHandoverBundles } from "@/lib/wardflow";

export default async function HandoverPage() {
  const session = await requireAppSession();
  const bundles = await getHandoverBundles(session);

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
        subtitle="จัดลำดับคนวิกฤตก่อน ตามด้วยคนที่ต้องเฝ้าระวัง งานค้าง และงานที่ติดปัญหา"
      >
        {bundles.length ? (
          <HandoverCards bundles={bundles} />
        ) : (
          <EmptyState
            title="Nothing to hand over"
            body="อาจยังไม่มีข้อมูลในวอร์ด หรือผู้ป่วยทั้งหมดคงที่และไม่มีรายการที่ต้องเฝ้าระวัง"
          />
        )}
      </GlassPanel>
    </div>
  );
}
