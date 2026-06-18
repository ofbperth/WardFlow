import { AdminSectionTabs } from "@/components/admin-section-tabs";
import { StudentWardAssignmentBoard } from "@/components/student-ward-assignment-board";
import { requireAdminSession } from "@/lib/auth";

export default async function AdminStudentWardAssignmentPage() {
  await requireAdminSession();

  return (
    <div className="space-y-6">
      <AdminSectionTabs />
      <StudentWardAssignmentBoard />
    </div>
  );
}
