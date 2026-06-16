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
        subtitle="รวมงานที่ assign ให้คุณ พร้อมบริบทผู้ป่วย เพื่อปิดงานได้เร็วขึ้น"
      >
        {items.length ? (
          <TaskInbox items={items} />
        ) : (
          <EmptyState
            title="No assigned tasks"
            body="เมื่อมีคน assign task ให้ งานจะขึ้นที่หน้านี้พร้อมข้อมูลผู้ป่วย"
          />
        )}
      </GlassPanel>
    </div>
  );
}
