import Link from "next/link";
import { saveWardAction } from "@/app/actions";
import {
  Field,
  GlassPanel,
  SectionLabel,
  SubmitButton,
  TextInput,
} from "@/components/wardflow-ui";
import { requireAdminSession } from "@/lib/auth";
import { getWardSummaries } from "@/lib/wardflow";

export default async function AdminWardsPage() {
  const session = await requireAdminSession();
  const summaries = await getWardSummaries(session);

  return (
    <div className="space-y-6">
      <GlassPanel
        title="Admin · wards"
        subtitle="Manage ward containers used for census, assignment, and handover scope."
        action={
          <Link
            href="/admin/task-templates"
            className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-foreground"
          >
            Task templates
          </Link>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <div className="grid gap-3 md:grid-cols-2">
            {summaries.map((summary) => (
              <div key={summary.ward.id} className="rounded-[28px] bg-white/75 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Ward</p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">{summary.ward.name}</h3>
                <p className="mt-2 text-sm text-muted">{summary.patients.length} patients visible</p>
              </div>
            ))}
          </div>

          <GlassPanel title="Create ward" subtitle="Keep names short and operational.">
            <SectionLabel>New ward</SectionLabel>
            <form action={saveWardAction} className="space-y-3">
              <Field label="Ward name">
                <TextInput name="name" placeholder="Medical B" required />
              </Field>
              <SubmitButton>Create ward</SubmitButton>
            </form>
          </GlassPanel>
        </div>
      </GlassPanel>
    </div>
  );
}
