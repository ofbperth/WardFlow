import type { ProgressSaveInput, ProgressSnapshot } from "./progress-autosave";

const prefix = "wardflow:progress-draft:v1:";
export type ProgressDraft = { note: string; base: ProgressSnapshot; request: ProgressSaveInput | null };
// In-memory fallback keeps Back/Forward safe even when browser storage is unavailable.
const drafts = new Map<string, ProgressDraft>();

export function progressDraftKey(ownerId: string, patientId: string, problemId: string) {
  return `${prefix}${encodeURIComponent(ownerId)}:${encodeURIComponent(patientId)}:${encodeURIComponent(problemId)}`;
}

export function readProgressDraft(key: string): ProgressDraft | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const draft = JSON.parse(raw) as ProgressDraft;
      if (typeof draft.note === "string" && typeof draft.base?.note === "string" &&
          (draft.base.id === null || typeof draft.base.id === "string") &&
          (draft.base.updatedAt === null || typeof draft.base.updatedAt === "string") &&
          (draft.request === null || (typeof draft.request?.requestId === "string" && typeof draft.request.note === "string"))) {
        drafts.set(key, draft);
        return draft;
      }
    }
  } catch { /* Memory remains available when storage is disabled or full. */ }
  return drafts.get(key) ?? null;
}

export function writeProgressDraft(key: string, draft: ProgressDraft): boolean {
  drafts.set(key, draft);
  try { sessionStorage.setItem(key, JSON.stringify(draft)); return true; }
  catch { return false; }
}

export function removeProgressDraft(key: string) {
  drafts.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
}

export function acknowledgeProgressDraft(key: string, requestId: string, snapshot: ProgressSnapshot) {
  const draft = readProgressDraft(key);
  // An old response must not clear typing or a newer request after remount.
  if (draft?.request?.requestId !== requestId) return;
  if (draft.note === snapshot.note) removeProgressDraft(key);
  else writeProgressDraft(key, { note: draft.note, base: snapshot, request: null });
}

export function clearProgressDrafts() {
  drafts.clear();
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch { /* Storage may be disabled. */ }
}

export function hasProgressDrafts() {
  if (drafts.size) return true;
  try {
    for (let i = 0; i < sessionStorage.length; i++) if (sessionStorage.key(i)?.startsWith(prefix)) return true;
  } catch { /* Check memory only when browser storage is unavailable. */ }
  return false;
}
