export const UNASSIGNED_OWNER_FILTER = "unassigned";

export function matchesTaskOwner(ownerId: string | null | undefined, filter: string | undefined): boolean {
  if (!filter) return true;
  if (filter === UNASSIGNED_OWNER_FILTER) return !ownerId;
  return ownerId === filter;
}
