import Link from "next/link";
import { saveWardAction, updateUserRoleAction } from "@/app/actions";
import {
  Field,
  GlassPanel,
  SectionLabel,
  StaffRoleCards,
  SubmitButton,
  TextInput,
} from "@/components/wardflow-ui";
import { requireAdminSession } from "@/lib/auth";
import { getProfiles, getWardSummaries } from "@/lib/wardflow";

export default async function AdminWardsPage() {
  const session = await requireAdminSession();
  const [summaries, profiles] = await Promise.all([
    getWardSummaries(session),
    getProfiles(session),
  ]);

  return (
    <div className="space-y-6">
      <GlassPanel
        title="Admin | Ward management"
        subtitle="แก้ชื่อวอร์ด สร้างวอร์ดใหม่ และจัดการ role ของผู้ใช้จากหน้านี้"
        action={
          <Link
            href="/admin/task-templates"
            className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-foreground"
          >
            Task templates
          </Link>
        }
      >
        <div className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <SectionLabel>Ward management</SectionLabel>
            <div className="grid gap-3 xl:grid-cols-2">
              {summaries.map((summary) => (
                <div key={summary.ward.id} className="rounded-[28px] bg-white/75 p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">วอร์ด</p>
                  <form action={saveWardAction} className="mt-3 space-y-3">
                    <input type="hidden" name="id" value={summary.ward.id} />
                    <TextInput name="name" defaultValue={summary.ward.name} required />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted">{summary.patients.length} คนที่ยังรักษาอยู่</p>
                      <SubmitButton>บันทึกวอร์ด</SubmitButton>
                    </div>
                  </form>
                </div>
              ))}
            </div>

            <GlassPanel title="Create ward" subtitle="ตั้งชื่อให้สั้น อ่านง่าย และใช้หน้างานจริง">
              <SectionLabel>New ward</SectionLabel>
              <form action={saveWardAction} className="space-y-3">
                <Field label="ชื่อวอร์ด">
                  <TextInput name="name" placeholder="Medical B" required />
                </Field>
                <SubmitButton>สร้างวอร์ด</SubmitButton>
              </form>
            </GlassPanel>
          </div>

          <div className="space-y-4">
            <GlassPanel title="User roles" subtitle="แอดมินเปลี่ยนสิทธิ์ผู้ใช้ได้จากหน้านี้ทันที">
              <StaffRoleCards profiles={profiles} updateUserRoleAction={updateUserRoleAction} />
            </GlassPanel>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
