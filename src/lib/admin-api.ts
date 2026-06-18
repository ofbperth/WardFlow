import { getCurrentSessionContext } from "@/lib/auth";

export async function getAdminApiSession() {
  const session = await getCurrentSessionContext();
  if (!session || session.profile.role !== "admin") {
    return null;
  }

  return session;
}
