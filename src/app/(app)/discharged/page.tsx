import Link from "next/link";
import { hardDeletePatientAction } from "@/app/actions";
import {
  DischargedPatientList,
  EmptyState,
  Field,
  GlassPanel,
  SelectBox,
  SubmitButton,
  TextInput,
} from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { getDischargeSummaryById, getDischargedDirectory } from "@/lib/wardflow";

export default async function DischargedPage({
  searchParams,
}: {
  searchParams: Promise<{
    wardId?: string;
    q?: string;
    page?: string;
    summaryId?: string;
  }>;
}) {
  const session = await requireAppSession();
  const canHardDelete = session.profile.role === "admin" || session.profile.role === "resident";
  const { wardId, q, page, summaryId } = await searchParams;
  const directory = await getDischargedDirectory(session, {
    wardId,
    query: q,
    page: Number(page || "1"),
  });
  const selectedSummary = summaryId ? await getDischargeSummaryById(session, summaryId) : null;

  return (
    <div className="space-y-6">
      <GlassPanel
        title="Discharged patients"
        subtitle="ค้นหาตามวอร์ดหรือชื่อคนไข้ เปิด summary ย้อนหลัง และ export Word ได้จากหน้านี้"
      >
        <form className="grid gap-3 rounded-[24px] bg-white/70 p-4 md:grid-cols-[1fr_1fr_auto]">
          <Field label="Ward">
            <SelectBox name="wardId" defaultValue={wardId ?? ""}>
              <option value="">All wards</option>
              {directory.wards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name}
                </option>
              ))}
            </SelectBox>
          </Field>
          <Field label="Patient search">
            <TextInput name="q" defaultValue={q ?? ""} placeholder="Name, diagnosis, or bed" />
          </Field>
          <div className="flex items-end">
            <SubmitButton>Apply filters</SubmitButton>
          </div>
        </form>

        <div className="mt-5 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            {directory.items.length ? (
              <>
                <DischargedPatientList
                  items={directory.items}
                  summaryId={summaryId ?? null}
                  canHardDelete={canHardDelete}
                  hardDeleteAction={hardDeletePatientAction}
                />
                <div className="flex items-center justify-between text-sm text-muted">
                  <span>
                    Showing {directory.items.length} of {directory.total} patients
                  </span>
                  <div className="flex gap-2">
                    <Link
                      href={buildDischargedUrl({
                        wardId,
                        q,
                        page: Math.max(1, directory.page - 1),
                        summaryId,
                      })}
                      className="rounded-full border border-white/70 bg-white px-4 py-2 font-semibold text-foreground"
                    >
                      Previous
                    </Link>
                    <span className="self-center">
                      Page {directory.page} / {directory.totalPages}
                    </span>
                    <Link
                      href={buildDischargedUrl({
                        wardId,
                        q,
                        page: Math.min(directory.totalPages, directory.page + 1),
                        summaryId,
                      })}
                      className="rounded-full border border-white/70 bg-white px-4 py-2 font-semibold text-foreground"
                    >
                      Next
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                title="No discharged patients yet"
                body="เมื่อ Resident หรือ Admin จำหน่ายผู้ป่วย รายการจะย้ายมาแสดงที่หน้านี้อัตโนมัติ"
              />
            )}
          </div>

          <div>
            {selectedSummary ? (
              <GlassPanel
                title={`Discharge summary | ${selectedSummary.patient.displayName}`}
                subtitle={`Created ${selectedSummary.summary.createdAt}`}
                action={
                  <a
                    href={`/api/discharge-summaries/${selectedSummary.summary.id}`}
                    className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-foreground"
                  >
                    Export Word
                  </a>
                }
              >
                <div className="space-y-4 text-sm text-foreground">
                  <SummaryRow label="Ward" value={selectedSummary.ward?.name ?? "-"} />
                  <SummaryRow label="Bed" value={selectedSummary.patient.bed} />
                  <SummaryRow
                    label="Admit date"
                    value={formatDateTime(selectedSummary.summary.admitDate)}
                  />
                  <SummaryRow
                    label="Discharge date"
                    value={formatDateTime(selectedSummary.summary.dischargeDate)}
                  />
                  <SummaryRow
                    label="Length of stay"
                    value={selectedSummary.summary.lengthOfStay || "-"}
                  />
                  <SummaryRow
                    label="Primary diagnosis"
                    value={selectedSummary.summary.primaryDiagnosis}
                  />
                  <SummaryRow
                    label="Hospital course"
                    value={selectedSummary.summary.hospitalCourse || "-"}
                  />
                  <SummaryRow label="Plan" value={selectedSummary.summary.plan || "-"} />
                  <SummaryRow
                    label="Home medication"
                    value={selectedSummary.summary.homeMedication || "-"}
                  />
                </div>
              </GlassPanel>
            ) : (
              <GlassPanel
                title="Discharge summary"
                subtitle="เลือกผู้ป่วยจากรายการฝั่งซ้ายเพื่อเปิด summary และ export Word"
              >
                <EmptyState
                  title="No summary selected"
                  body="กดที่การ์ดผู้ป่วยที่จำหน่ายแล้วเพื่อเปิด discharge summary"
                />
              </GlassPanel>
            )}
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

function buildDischargedUrl({
  wardId,
  q,
  page,
  summaryId,
}: {
  wardId?: string;
  q?: string;
  page?: number;
  summaryId?: string;
}) {
  const params = new URLSearchParams();
  if (wardId) params.set("wardId", wardId);
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  if (summaryId) params.set("summaryId", summaryId);
  const query = params.toString();
  return query ? `/discharged?${query}` : "/discharged";
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
