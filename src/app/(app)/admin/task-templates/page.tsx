import Link from "next/link";
import { AdminSectionTabs } from "@/components/admin-section-tabs";
import { saveTemplateAction } from "@/app/actions";
import {
  Field,
  GlassPanel,
  SectionLabel,
  SelectBox,
  SubmitButton,
  TemplateCards,
  TextInput,
} from "@/components/wardflow-ui";
import { requireAdminSession } from "@/lib/auth";
import { getTaskTemplates } from "@/lib/wardflow";

export default async function AdminTaskTemplatesPage() {
  const session = await requireAdminSession();
  const templates = await getTaskTemplates(session);

  return (
    <div className="space-y-6">
      <AdminSectionTabs />
      <GlassPanel
        title="Admin | Task templates"
        subtitle="ตั้ง template งานที่ใช้บ่อย เพื่อให้ทีมสร้าง task ได้เร็วและสม่ำเสมอ"
        action={
          <Link
            href="/admin/wards"
            className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-foreground"
          >
            กลับหน้าวอร์ด
          </Link>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <TemplateCards templates={templates} />

          <GlassPanel title="Create template" subtitle="ใช้ชื่อแบบ action เพื่อให้เลือกใช้ง่าย">
            <SectionLabel>New template</SectionLabel>
            <form action={saveTemplateAction} className="space-y-3">
              <Field label="Title">
                <TextInput name="title" placeholder="Follow blood gas" required />
              </Field>
              <Field label="Type">
                <SelectBox name="type" defaultValue="lab">
                  <option value="lab">lab</option>
                  <option value="imaging">imaging</option>
                  <option value="consult">consult</option>
                  <option value="procedure">procedure</option>
                  <option value="family_talk">Family talk</option>
                  <option value="discharge">Discharge</option>
                  <option value="medication">Medication</option>
                  <option value="other">Other</option>
                </SelectBox>
              </Field>
              <Field label="ความสำคัญเริ่มต้น">
                <SelectBox name="defaultPriority" defaultValue="normal">
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </SelectBox>
              </Field>
              <SubmitButton>สร้าง template</SubmitButton>
            </form>
          </GlassPanel>
        </div>
      </GlassPanel>
    </div>
  );
}
