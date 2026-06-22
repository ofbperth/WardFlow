import Link from "next/link";
import {
  deleteUserAdminAction,
  deleteWardAdminAction,
  saveWardAdminAction,
  updateUserRoleAdminAction,
} from "@/app/actions";
import { AdminFeedbackToast } from "@/components/admin-feedback-toast";
import { AdminSectionTabs } from "@/components/admin-section-tabs";
import { AdminCreator, AdminEditor } from "@/components/form-feedback";
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
        subtitle="Safer layout with collapsed edit actions and a separated danger zone."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/student-ward-assignment"
              className="rounded-full border border-mint-200 bg-mint-50 px-4 py-2 text-sm font-semibold text-mint-700"
            >
              Student Ward Assignment
            </Link>
            <Link
              href="/admin/task-templates"
              className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-foreground"
            >
              Task templates
            </Link>
          </div>
        }
      >
        <div className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="sticky top-4 z-20 rounded-full bg-white/75 px-4 py-3 backdrop-blur-xl">
              <SectionLabel>Ward management</SectionLabel>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {summaries.map((summary) => (
                <div key={summary.ward.id} className="rounded-[28px] bg-white/75 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Ward</p>
                      <p className="mt-2 text-lg font-semibold text-foreground">{summary.ward.name}</p>
                    </div>
                    <Pill tone="bg-white text-slate-700">
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

            <GlassPanel
              title="Create ward"
              subtitle="Create stays hidden until you intentionally open the form."
            >
              <div className="sticky top-20 z-10 rounded-full bg-white/70 px-4 py-3 backdrop-blur-xl">
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
                    className="rounded-2xl bg-rose-100/40 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{summary.ward.name}</p>
                        <p className="text-sm text-muted">{summary.patients.length} active patients</p>
                      </div>
                      <Pill
                        tone={
                          summary.patients.length === 0
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }
                      >
                        {summary.patients.length === 0 ? "Empty ward" : "Cannot delete yet"}
                      </Pill>
                    </div>

                    <div className="mt-3">
                      <form action={deleteWardAdminAction}>
                        <input type="hidden" name="wardId" value={summary.ward.id} />
                        <SubmitButton pendingLabel="Deleting...">Delete ward</SubmitButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </DangerZone>
          </div>

          <div className="space-y-4">
            <div className="sticky top-4 z-20 rounded-full bg-white/75 px-4 py-3 backdrop-blur-xl">
              <SectionLabel>User roles</SectionLabel>
            </div>
            <GlassPanel
              title="User roles"
              subtitle="Role changes are collapsed too, so the page stays calmer and safer to use."
            >
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
