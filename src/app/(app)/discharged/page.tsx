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
        subtitle="เมื่อจำหน่ายผู้ป่วยแล้ว การ์ดจะย้ายออกจาก active ward และมาอยู่หน้านี้อัตโนมัติ"
      >
        {summaries.some((summary) => summary.patients.length > 0) ? (
          <PatientCensus summaries={summaries} />
        ) : (
          <EmptyState
            title="No discharged patients yet"
            body="เมื่อ Resident หรือ Admin จำหน่ายผู้ป่วย รายการจะย้ายมาแสดงที่หน้านี้อัตโนมัติ"
          />
        )}
      </GlassPanel>
    </div>
  );
}
