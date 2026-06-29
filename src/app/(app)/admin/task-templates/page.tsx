import Link from "next/link";
import { saveTemplateAction } from "@/app/actions";
import { AdminSectionTabs } from "@/components/admin-section-tabs";
import { Field, GlassPanel, PageHeader, SelectBox, SubmitButton, TemplateCards, TextInput } from "@/components/wardflow-ui";
import { requireAdminSession } from "@/lib/auth";
import { getTaskTemplates } from "@/lib/wardflow";

export default async function AdminTaskTemplatesPage() {
  const session = await requireAdminSession();
  const templates = await getTaskTemplates(session);

  return (
    <div className="space-y-4 md:space-y-6">
      <AdminSectionTabs />
      <PageHeader
        title="Admin | Task templates"
        subtitle="Keep quick-entry and ward workflows consistent with reusable task defaults."
        action={
          <Link
            href="/admin/wards"
            className="button-secondary inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold"
          >
            Back to wards
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <GlassPanel title="Template library">
          <TemplateCards templates={templates} />
        </GlassPanel>

        <GlassPanel title="Create template" subtitle="Add new default work items for recurring ward routines.">
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
            <Field label="Default priority">
              <SelectBox name="defaultPriority" defaultValue="normal">
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </SelectBox>
            </Field>
            <SubmitButton>Create template</SubmitButton>
          </form>
        </GlassPanel>
      </div>
    </div>
  );
}
