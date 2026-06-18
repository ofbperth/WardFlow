import { redirect } from "next/navigation";
import { AppFeedbackToast } from "@/components/app-feedback-toast";
import { EmptyState, Field, GlassPanel, SelectBox, SetupNotice, SubmitButton } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getBulkTaskEntryData } from "@/lib/wardflow";

export default async function QuickTaskEntryLandingPage({
  searchParams,
}: {
  searchParams?: Promise<{ toast?: string; wardId?: string }>;
}) {
  const session = await requireAppSession();
  const params = (await searchParams) ?? {};
  const selectedWardId = params.wardId?.trim() ?? "";

  if (selectedWardId) {
    redirect(`/tasks/quick/${selectedWardId}`);
  }

  const data = await getBulkTaskEntryData(session);

  return (
    <div className="space-y-6">
      <AppFeedbackToast toastKey={params.toast} />

      <GlassPanel
        title="Quick task entry"
        subtitle="เลือก ward ก่อน แล้วค่อยเข้า quick task entry ของวอร์ดนั้นเพื่อสร้างหลาย task ได้เร็วขึ้น"
      >
        {data.blockedByMissingWard ? (
          <SetupNotice
            title="Student ward assignment required"
            body="รอ admin assign ward ให้ก่อน จึงจะใช้ quick task entry ได้"
          />
        ) : data.wardSummaries.length ? (
          <form className="max-w-xl space-y-4">
            <Field label="Ward">
              <SelectBox name="wardId" defaultValue={data.defaultWardId}>
                <option value="">Select ward</option>
                {data.wardSummaries.map((summary) => (
                  <option key={summary.ward.id} value={summary.ward.id}>
                    {summary.ward.name}
                  </option>
                ))}
              </SelectBox>
            </Field>

            <div className="flex justify-end">
              <SubmitButton>Open quick task entry</SubmitButton>
            </div>
          </form>
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
