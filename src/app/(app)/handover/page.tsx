import { RealtimeRefresh } from "@/components/realtime-refresh";
import { EmptyState, GlassPanel, HandoverCards } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getHandoverBundles } from "@/lib/wardflow";

export default async function HandoverPage() {
  const session = await requireAppSession();
  const bundles = await getHandoverBundles(session);

  return (
    <div className="space-y-6">
      <RealtimeRefresh
        channel="handover-live"
        filters={[
          { schema: "public", table: "patients" },
          { schema: "public", table: "problems" },
          { schema: "public", table: "ward_tasks" },
          { schema: "public", table: "handover_notes" },
        ]}
      />

      <GlassPanel
        title="Handover mode"
        subtitle="Critical first. Watch second. Pending and blocked next. Stable / no-issue patients stay quiet by default."
      >
        {bundles.length ? (
          <HandoverCards bundles={bundles} />
        ) : (
          <EmptyState
            title="Nothing to hand over"
            body="No visible ward data yet, or all patients are stable with no active watch items."
          />
        )}
      </GlassPanel>
    </div>
  );
}
