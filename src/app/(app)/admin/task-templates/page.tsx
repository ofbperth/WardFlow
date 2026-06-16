import Link from "next/link";
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
  await requireAdminSession();
  const templates = await getTaskTemplates();

  return (
    <div className="space-y-6">
      <GlassPanel
        title="Admin · task templates"
        subtitle="Seed the repeatable ward work patterns your team uses every day."
        action={
          <Link
            href="/admin/wards"
            className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-foreground"
          >
            Back to wards
          </Link>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <TemplateCards templates={templates} />

          <GlassPanel title="Create template" subtitle="Use action-oriented wording.">
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
                  <option value="family_talk">family_talk</option>
                  <option value="discharge">discharge</option>
                  <option value="medication">medication</option>
                  <option value="other">other</option>
                </SelectBox>
              </Field>
              <Field label="Default priority">
                <SelectBox name="defaultPriority" defaultValue="normal">
                  <option value="normal">Normal</option>
                  <option value="urgency">Urgency</option>
                  <option value="emergency">Emergency</option>
                </SelectBox>
              </Field>
              <SubmitButton>Create template</SubmitButton>
            </form>
          </GlassPanel>
        </div>
      </GlassPanel>
    </div>
  );
}
