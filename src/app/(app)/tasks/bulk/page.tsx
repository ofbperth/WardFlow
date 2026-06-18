import { redirect } from "next/navigation";

export default async function LegacyBulkTaskPage() {
  redirect("/tasks/quick");
}
