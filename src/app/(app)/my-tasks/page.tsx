import { EmptyState, GlassPanel, TaskInbox } from "@/components/wardflow-ui";
import { requireAppSession } from "@/lib/auth";
import { getMyTasks } from "@/lib/wardflow";

export default async function MyTasksPage() {
  const session = await requireAppSession();
  const items = await getMyTasks(session);

  return (
    <div className="space-y-6">
      <GlassPanel
        title="My tasks"
        subtitle="Owner-scoped queue for finishing the shift without hunting through paper."
      >
        {items.length ? (
          <TaskInbox items={items} />
        ) : (
          <EmptyState
            title="No tasks assigned"
            body="Once tasks are assigned to you, they will appear here with patient context."
          />
        )}
      </GlassPanel>
    </div>
  );
}
