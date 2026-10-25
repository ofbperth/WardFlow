import assert from "node:assert/strict";
import test from "node:test";
import { canEditProgressNote } from "../src/lib/progress-autosave.js";
import { acknowledgeProgressDraft, clearProgressDrafts, progressDraftKey, readProgressDraft, writeProgressDraft } from "../src/lib/progress-draft.js";

test("Student is read-only; residents must be assigned; admin can write", () => {
  assert.equal(canEditProgressNote({ role: "student", residentWardIds: [] }, "ward-1"), false);
  assert.equal(canEditProgressNote({ role: "resident", residentWardIds: ["ward-1"] }, "ward-1"), true);
  assert.equal(canEditProgressNote({ role: "resident", residentWardIds: ["ward-2"] }, "ward-1"), false);
  assert.equal(canEditProgressNote({ role: "admin", residentWardIds: [] }, "ward-1"), true);
});

test("draft acknowledgement preserves newer typing and ignores stale responses", () => {
  clearProgressDrafts();
  const key = progressDraftKey("user", "patient", "problem");
  const base = { id: "old", updatedAt: "old-time", note: "old text" };
  const request = { patientId: "patient", problemId: "problem", requestId: "request-1", expectedId: base.id, expectedUpdatedAt: base.updatedAt, note: "sent text" };
  writeProgressDraft(key, { note: "newer typing", base, request });
  acknowledgeProgressDraft(key, "stale-request", { id: "wrong", updatedAt: "wrong", note: "wrong" });
  assert.equal(readProgressDraft(key)?.note, "newer typing");
  const snapshot = { id: "new", updatedAt: "new-time", note: "sent text" };
  acknowledgeProgressDraft(key, request.requestId, snapshot);
  assert.deepEqual(readProgressDraft(key), { note: "newer typing", base: snapshot, request: null });
  writeProgressDraft(key, { note: "newer typing", base: snapshot, request: { ...request, requestId: "request-2", note: "newer typing" } });
  acknowledgeProgressDraft(key, "request-2", { id: "final", updatedAt: "final-time", note: "newer typing" });
  assert.equal(readProgressDraft(key), null);
});

test("drafts are isolated by user, patient and problem and cleared on logout", () => {
  const key = progressDraftKey("user-1", "patient-1", "problem-1");
  writeProgressDraft(key, { note: "private draft", base: { id: null, updatedAt: null, note: "" }, request: null });
  assert.equal(readProgressDraft(progressDraftKey("user-2", "patient-1", "problem-1")), null);
  assert.equal(readProgressDraft(progressDraftKey("user-1", "patient-2", "problem-1")), null);
  assert.equal(readProgressDraft(progressDraftKey("user-1", "patient-1", "problem-2")), null);
  clearProgressDrafts();
  assert.equal(readProgressDraft(key), null);
});
