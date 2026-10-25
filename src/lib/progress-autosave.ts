export type ProgressSnapshot = { id: string | null; updatedAt: string | null; note: string };
export type ProgressSaveInput = {
  patientId: string;
  problemId: string;
  requestId: string;
  expectedId: string | null;
  expectedUpdatedAt: string | null;
  note: string;
};
export type ProgressSaveResult =
  | { ok: true; snapshot: ProgressSnapshot }
  | { ok: false; conflict?: boolean; message: string };
