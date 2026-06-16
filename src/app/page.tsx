import { redirect } from "next/navigation";
import { getCurrentSessionContext } from "@/lib/auth";

export default async function HomePage() {
  const session = await getCurrentSessionContext();
  redirect(session ? "/wards" : "/login");
}
