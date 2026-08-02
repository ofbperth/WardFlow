export type ResidentWardPair = { residentId: string; wardId: string };

export function visibleWardIdsForRole(input: {
  role: "admin" | "resident" | "student";
  residentWardIds?: string[];
  studentWardId?: string | null;
  allWardIds: string[];
}) {
  if (input.role === "admin") return input.allWardIds;
  if (input.role === "resident") return [...new Set(input.residentWardIds ?? [])];
  return input.studentWardId ? [input.studentWardId] : [];
}

export function replaceResidentsForWard(
  current: ResidentWardPair[],
  wardId: string,
  residentIds: string[],
): ResidentWardPair[] {
  if (new Set(residentIds).size !== residentIds.length) {
    throw new Error("Duplicate resident selection is not allowed");
  }
  return [
    ...current.filter((assignment) => assignment.wardId !== wardId),
    ...residentIds.map((residentId) => ({ residentId, wardId })),
  ];
}

export function isProfileAssignableToWard(
  profile: { role: "admin" | "resident" | "student"; residentWardIds?: string[]; wardAssignment?: string | null },
  wardId: string,
) {
  return profile.role === "admin" ||
    (profile.role === "resident" && (profile.residentWardIds ?? []).includes(wardId)) ||
    (profile.role === "student" && profile.wardAssignment === wardId);
}
