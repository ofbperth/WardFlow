import Link from "next/link";
import { notFound } from "next/navigation";
import { quickCreateTasksAction } from "@/app/actions";
import { AppFeedbackToast } from "@/components/app-feedback-toast";
import { BulkTaskEntryBuilder } from "@/components/bulk-task-entry-builder";
import { GlassPanel, SetupNotice } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getBulkTaskEntryData } from "@/lib/wardflow";

export default async function QuickTaskEntryWardPage({
  params,
  searchParams,
}: {
  params: Promise<{ wardId: string }>;
  searchParams?: Promise<{ toast?: string }>;
}) {
  const session = await requireAppSession();
  const routeParams = await params;
  const query = (await searchParams) ?? {};
  const data = await getBulkTaskEntryData(session);
  const wardSummary = data.wardSummaries.find((summary) => summary.ward.id === routeParams.wardId);
  const profileCount = wardSummary ? (data.profilesByWard[wardSummary.ward.id] ?? []).length : 0;

  if (!data.blockedByMissingWard && !wardSummary) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <AppFeedbackToast toastKey={query.toast} />

      <GlassPanel
        headingLevel={1}
        title="Quick task entry"
        subtitle={
          wardSummary
            ? `สร้างหลาย task ใน ${wardSummary.ward.name} ได้ในหน้าเดียว พร้อม default assignment และ template ที่ใช้บ่อย`
            : "สร้างหลาย task ได้เร็วขึ้นใน ward ที่ได้รับมอบหมาย"
        }
        action={
          <Link
            href="/tasks/quick"
            className="rounded-full border clinical-divider bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-[var(--surface-muted)]"
          >
            Change ward
          </Link>
        }
        className="overflow-hidden"
      >
        {data.blockedByMissingWard ? (
          <SetupNotice
            title="Student ward assignment required"
            body="รอ admin assign ward ให้ก่อน จึงจะใช้ quick task entry ได้"
          />
        ) : wardSummary ? (
          <div className="space-y-5">
            <section className="grid gap-3 border-b clinical-divider pb-5 md:grid-cols-4">
              <WardEntryMetric label="Selected ward" value={wardSummary.ward.name} note="workspace ที่กำลังแก้ไข" />
              <WardEntryMetric
                label="Patients"
                value={`${wardSummary.patients.length}`}
                note="active patients ใน scope ตอนนี้"
              />
              <WardEntryMetric label="Templates" value={`${data.templates.length}`} note="เลือกใช้หรือยิงจาก instant action" />
              <WardEntryMetric label="Assignable staff" value={`${profileCount}`} note="รายชื่อที่ assign ได้ใน ward นี้" />
            </section>

            <BulkTaskEntryBuilder
              wardSummary={wardSummary}
              templates={data.templates}
              profiles={data.profilesByWard[wardSummary.ward.id] ?? []}
              submitAction={quickCreateTasksAction}
            />
          </div>
        ) : null}
      </GlassPanel>
    </div>
  );
}

function WardEntryMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[24px] bg-[var(--surface-muted)] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{note}</p>
    </div>
  );
}
