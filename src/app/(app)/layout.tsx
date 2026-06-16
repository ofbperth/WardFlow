import { AppShell } from "@/components/app-shell";
import { requireAppSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireAppSession();

  return (
    <AppShell profile={session.profile}>
      {children}
    </AppShell>
  );
}
