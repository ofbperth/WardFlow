import Link from "next/link";
import {
  deleteUserAdminAction,
  deleteWardAdminAction,
  saveWardAdminAction,
  updateUserRoleAdminAction,
} from "@/app/actions";
import { AdminFeedbackToast } from "@/components/admin-feedback-toast";
import { AdminSectionTabs } from "@/components/admin-section-tabs";
import { AdminCreator, AdminEditor, PendingSubmitButton } from "@/components/form-feedback";
import {
  DangerZone,
  Field,
  GlassPanel,
  Pill,
  SectionLabel,
  StaffRoleCards,
  SubmitButton,
  TextInput,
} from "@/components/wardflow-ui";
import { requireAdminSession } from "@/lib/auth";
import { getProfiles, getWardSummaries } from "@/lib/wardflow";

export default async function AdminWardsPage({
  searchParams,
}: {
  searchParams?: Promise<{ toast?: string }>;
}) {
  const session = await requireAdminSession();
  const params = (await searchParams) ?? {};
  const [summaries, profiles] = await Promise.all([getWardSummaries(session), getProfiles(session)]);

  return (
    <div className="space-y-6">
      <AdminFeedbackToast toastKey={params.toast} />
      <AdminSectionTabs />

      <GlassPanel
        headingLevel={1}
        title="Admin | Ward management"
        subtitle="Control ward setup, student assignment entry points, and staff access from one operations surface."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/student-ward-assignment"
              className="button-secondary inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-[color:var(--color-accent-strong)]"
            >
              Student Ward Assignment
            </Link>
            <Link
              href="/admin/task-templates"
              className="button-secondary inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold"
            >
              Task templates
            </Link>
          </div>
        }
      >
        <div className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="panel-muted rounded-full px-4 py-3">
              <SectionLabel>Ward management</SectionLabel>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              {summaries.map((summary) => (
                <div key={summary.ward.id} className="panel-surface rounded-[28px] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Ward</p>
                      <p className="mt-2 text-lg font-semibold text-foreground">{summary.ward.name}</p>
                    </div>
                    <Pill tone="border-[color:var(--color-rule)] bg-[color:var(--color-paper-3)] text-[color:var(--color-ink-2)]">
                      {summary.patients.length} active patients
                    </Pill>
                  </div>

                  <AdminEditor buttonLabel="Edit ward" panelTitle={`Edit ward | ${summary.ward.name}`}>
                    <form action={saveWardAdminAction} className="space-y-3">
                      <input type="hidden" name="id" value={summary.ward.id} />
                      <Field label="Ward name">
                        <TextInput name="name" defaultValue={summary.ward.name} required />
                      </Field>
                      <SubmitButton>Save ward</SubmitButton>
                    </form>
                  </AdminEditor>
                </div>
              ))}
            </div>

            <GlassPanel title="Create ward" subtitle="Add a new clinical area without leaving this console.">
              <div className="panel-muted rounded-full px-4 py-3">
                <SectionLabel>New ward</SectionLabel>
              </div>
              <AdminCreator buttonLabel="Create new ward" panelTitle="Create ward">
                <form action={saveWardAdminAction} className="space-y-3">
                  <Field label="Ward name">
                    <TextInput name="name" placeholder="Medical B" required />
                  </Field>
                  <SubmitButton>Create ward</SubmitButton>
                </form>
              </AdminCreator>
            </GlassPanel>

            <DangerZone
              title="Danger zone"
              description="Ward deletion stays hidden until you open this panel, but no extra typing is required."
            >
              <div className="space-y-3">
                {summaries.map((summary) => (
                  <div
                    key={`delete-${summary.ward.id}`}
                    className="rounded-2xl border border-[color:var(--color-danger)]/20 bg-white/85 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{summary.ward.name}</p>
                        <p className="text-sm text-muted">{summary.patients.length} active patients</p>
                      </div>
                      <Pill
                        tone={
                          summary.patients.length === 0
                            ? "border-[color:var(--color-accent)]/20 bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-strong)]"
                            : "border-[color:var(--color-warning)]/35 bg-[color:var(--color-warning)]/12 text-foreground"
                        }
                      >
                        {summary.patients.length === 0 ? "Empty ward" : "Cannot delete yet"}
                      </Pill>
                    </div>

                    <div className="mt-3">
                      <form action={deleteWardAdminAction}>
                        <input type="hidden" name="wardId" value={summary.ward.id} />
                        <PendingSubmitButton pendingLabel="Deleting..." className="button-danger">
                          Delete ward
                        </PendingSubmitButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </DangerZone>
          </div>

          <div className="space-y-4">
            <div className="panel-muted rounded-full px-4 py-3">
              <SectionLabel>User roles</SectionLabel>
            </div>
            <GlassPanel title="User roles" subtitle="Adjust roles and ward assignment without leaving the admin shell.">
              <StaffRoleCards
                profiles={profiles}
                wards={summaries.map((summary) => summary.ward)}
                updateUserRoleAction={updateUserRoleAdminAction}
                deleteUserAction={deleteUserAdminAction}
              />
            </GlassPanel>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
