export type UnderlyingSaveInput = {
  patientId: string;
  expectedValue: string | null;
  note: string;
};
export type UnderlyingSaveResult =
  | { ok: true; value: string | null }
  | { ok: false; conflict?: boolean; retryable?: boolean; message: string };
export type UnderlyingDraft = {
  note: string;
  base: string | null;
  request: (UnderlyingSaveInput & { requestId: string }) | null;
};

const prefix = "wardflow:underlying-draft:v1:";
const drafts = new Map<string, UnderlyingDraft>();
export function underlyingDraftKey(ownerId: string, patientId: string) {
  return `${prefix}${encodeURIComponent(ownerId)}:${encodeURIComponent(patientId)}`;
}
export function readUnderlyingDraft(key: string): UnderlyingDraft | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const draft = JSON.parse(raw) as UnderlyingDraft;
      if (typeof draft.note === "string" && (draft.base === null || typeof draft.base === "string") &&
          (draft.request === null || (typeof draft.request?.requestId === "string" &&
            typeof draft.request.patientId === "string" && typeof draft.request.note === "string" &&
            (draft.request.expectedValue === null || typeof draft.request.expectedValue === "string")))) {
        drafts.set(key, draft);
        return draft;
      }
    }
  } catch { /* Use the in-memory draft when storage is unavailable. */ }
  return drafts.get(key) ?? null;
}
export function writeUnderlyingDraft(key: string, draft: UnderlyingDraft) {
  drafts.set(key, draft);
  try { sessionStorage.setItem(key, JSON.stringify(draft)); return true; }
  catch { return false; }
}
export function removeUnderlyingDraft(key: string) {
  drafts.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
}
export function acknowledgeUnderlyingDraft(key: string, requestId: string, value: string | null) {
  const draft = readUnderlyingDraft(key);
  if (draft?.request?.requestId !== requestId) return;
  if (draft.note === (value ?? "")) removeUnderlyingDraft(key);
  else writeUnderlyingDraft(key, { note: draft.note, base: value, request: null });
}
export function hasUnderlyingDrafts() {
  if (drafts.size) return true;
  try {
    for (let i = 0; i < sessionStorage.length; i++) if (sessionStorage.key(i)?.startsWith(prefix)) return true;
  } catch { /* Use memory only. */ }
  return false;
}
export function clearUnderlyingDrafts() {
  drafts.clear();
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch { /* Storage may be unavailable. */ }
}
