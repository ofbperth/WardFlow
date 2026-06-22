import Link from "next/link";
import { AppFeedbackToast } from "@/components/app-feedback-toast";
import { EmptyState, GlassPanel, SetupNotice } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getBulkTaskEntryData } from "@/lib/wardflow";

export default async function QuickTaskEntryLandingPage({
  searchParams,
}: {
  searchParams?: Promise<{ toast?: string }>;
}) {
  const session = await requireAppSession();
  const params = (await searchParams) ?? {};
  const data = await getBulkTaskEntryData(session);

  return (
    <div className="space-y-6">
      <AppFeedbackToast toastKey={params.toast} />

      <GlassPanel
        headingLevel={1}
        title="Quick task entry"
        subtitle="เลือก ward จาก card ด้านล่าง แล้วเข้า quick task entry ของวอร์ดนั้นได้ทันที"
      >
        {data.blockedByMissingWard ? (
          <SetupNotice
            title="Student ward assignment required"
            body="รอ admin assign ward ให้ก่อน จึงจะใช้ quick task entry ได้"
          />
        ) : data.wardSummaries.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.wardSummaries.map((summary) => (
              <Link
                key={summary.ward.id}
                href={`/tasks/quick/${summary.ward.id}`}
                className="group rounded-[28px] border border-white/70 bg-white/72 p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-xl hover:shadow-mint-950/10"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Ward</p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">{summary.ward.name}</h3>
                <p className="mt-2 text-sm text-muted">
                  {summary.patients.length} active patients ready for quick entry
                </p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="rounded-full bg-mint-50 px-3 py-1.5 font-semibold text-mint-700">
                    Open
                  </span>
                  <span className="text-muted group-hover:text-foreground">Click to select</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No ward available"
            body="ยังไม่มี ward ที่คุณเข้าถึงได้สำหรับ quick task entry ในตอนนี้"
          />
        )}
      </GlassPanel>
    </div>
  );
}
