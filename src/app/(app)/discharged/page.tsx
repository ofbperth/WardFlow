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
import { getDischargedDirectory } from "@/lib/wardflow";

export default async function DischargedPage({
  searchParams,
}: {
  searchParams: Promise<{
    wardId?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const session = await requireAppSession();
  const canHardDelete = session.profile.role === "admin" || session.profile.role === "resident";
  const { wardId, q, page } = await searchParams;
  const directory = await getDischargedDirectory(session, {
    wardId,
    query: q,
    page: Number(page || "1"),
  });

  return (
    <div className="space-y-6">
      <GlassPanel
        title="Discharged patients"
        subtitle="Search by ward or patient name, then open the read-only discharge summary from each card."
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

        <div className="mt-5 space-y-4">
          {directory.items.length ? (
            <>
              <DischargedPatientList
                items={directory.items}
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
              body="Discharged patients will appear here automatically after Resident or Admin completes the discharge flow."
            />
          )}
        </div>
      </GlassPanel>
    </div>
  );
}

function buildDischargedUrl({
  wardId,
  q,
  page,
}: {
  wardId?: string;
  q?: string;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (wardId) params.set("wardId", wardId);
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/discharged?${query}` : "/discharged";
}
