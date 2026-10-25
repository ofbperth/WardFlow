import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

// Load the actual TypeScript modules, resolving the same aliases as Next.
// Only server IO is replaced in the action tests; note formatting is never mocked.
function loadSource(relative, overrides = {}, cache = new Map()) {
  const filename = path.resolve(testDirectory, "..", relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = { exports: {} };
  cache.set(filename, loaded);
  const nativeRequire = Module.createRequire(filename);
  const requireSource = (name) => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.startsWith("@/")) return loadSource(`src/${name.slice(2)}.ts`, overrides, cache);
    return nativeRequire(name);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", compiled)(requireSource, loaded, loaded.exports);
  return loaded.exports;
}

const { buildSummaryNotePayload } = loadSource("src/lib/summary-note.ts");
const { buildGoogleDocsRequests } = loadSource("src/lib/google-docs.ts");
const { serializeProgressNote } = loadSource("src/lib/progress-format.ts");
const { demoPatientsSeed } = loadSource("src/lib/demo-data.ts");

function input() {
  return {
    patient: { ...demoPatientsSeed[0], displayName: "ทดสอบ", age: null, sex: null,
      hospitalNumber: null, underlyingDisease: null, responsibleDoctorName: null,
      diagnosis: "", allergy: null, precaution: "none" },
    ward: null, problems: [], tasks: [], handover: null, activity: [],
  };
}

function docText(payload) {
  return buildGoogleDocsRequests(payload).flatMap(request => request.insertText?.text ?? []).join("");
}

test("empty, whitespace and placeholder fields omit headings from both exports", () => {
  for (const empty of [null, "", " \n ", "-"]) {
    const data = input();
    Object.assign(data.patient, { hospitalNumber: empty, underlyingDisease: empty, allergy: empty, diagnosis: empty });
    const payload = buildSummaryNotePayload(data);
    for (const text of [payload.plainText, docText(payload)]) {
      for (const heading of ["HN:", "U/D", "Brief Background", "Reason for Admission", "Hospital Course",
        "Active Problem List", "Consultations", "Pending Issues", "Safety Alerts", "Ward work", "Admission date:"]) {
        assert(!text.includes(heading), `${JSON.stringify(empty)} contains ${heading}`);
      }
      assert(!text.includes("No latest note"));
    }
  }
});

test("identification preserves Thai, age zero and explicitly recorded negative history", () => {
  const data = input();
  Object.assign(data.patient, { age: 0, hospitalNumber: "0123", underlyingDisease: "ไม่มีโรคประจำตัว" });
  const payload = buildSummaryNotePayload(data);
  assert(payload.plainText.includes("ชื่อ ทดสอบ อายุ 0 ปี\n0123\nU/D ไม่มีโรคประจำตัว"));
  assert(docText(payload).includes("ไม่มีโรคประจำตัว"));
});

test("missing creation activity does not invent admission date from another event", () => {
  const data = input();
  data.activity = [{ action: "patient.updated", createdAt: "2026-10-25T10:00:00Z" }];
  assert(!docText(buildSummaryNotePayload(data)).includes("Admission date"));
  data.activity.push({ action: "patient.created", createdAt: "2026-10-20T10:00:00Z" });
  assert(docText(buildSummaryNotePayload(data)).includes("Admission date: 2026-10-20"));
});

test("problem text preserves negative numbers and formatted notes without empty labels", () => {
  const data = input();
  data.problems = [{ id: "p1", problemName: "Test problem", priority: "ACTIVE_STABLE",
    diagnosisStatus: "confirmed", resolvedAt: null, currentStatusSummary: "-5 mmol/L\n- recorded detail",
    latestEntry: { note: serializeProgressNote([{ type: "heading", text: "ผลตรวจ" }, { type: "paragraph", text: "-2.5" }]) },
    linkedTasks: [] }];
  const payload = buildSummaryNotePayload(data);
  for (const text of [payload.plainText, docText(payload)]) {
    assert(text.includes("-5 mmol/L"));
    assert(text.includes("-2.5"));
    assert(text.includes("ผลตรวจ"));
    assert(!text.includes("wardflow-note:v1:"));
    assert(!text.includes("Pending Ward work:"));
  }
  data.problems[0].currentStatusSummary = "-";
  data.problems[0].latestEntry = null;
  const emptyDetails = buildSummaryNotePayload(data);
  for (const text of [emptyDetails.plainText, docText(emptyDetails)]) {
    assert(!text.includes("Current Summary:"));
    assert(!text.includes("Latest Note:"));
    assert(!text.includes("Test problem | -"));
  }
});

test("Google Docs request indices remain contiguous with Thai and emoji", () => {
  const data = input();
  data.patient.diagnosis = "ภาษาไทย 🧪\nSecond line";
  const requests = buildGoogleDocsRequests(buildSummaryNotePayload(data));
  let cursor = 1;
  for (const request of requests) {
    if (request.insertText) {
      assert.equal(request.insertText.location.index, cursor);
      cursor += request.insertText.text.length;
    } else {
      const range = (request.updateParagraphStyle ?? request.createParagraphBullets).range;
      assert(range.startIndex >= 1 && range.endIndex <= cursor && range.endIndex > range.startIndex);
    }
  }
});

function exportAction(exportSummaryNoteDocument) {
  return loadSource("src/app/actions.ts", {
    "next/headers": {},
    "@/lib/auth": { requireAppSession: async () => ({ mode: "demo" }) },
    "@/lib/env": {}, "@/lib/supabase/server": {},
    "@/lib/wardflow": { exportSummaryNoteDocument },
  }).exportSummaryNoteGoogleDocsAction;
}

test("successful export propagates Next redirect to Google Docs instead of catching it", async () => {
  const action = exportAction(async () => ({ documentUrl: "https://docs.google.com/document/d/test/edit" }));
  const form = new FormData();
  form.set("patientId", "test");
  await assert.rejects(action(form), error => error.digest === "NEXT_REDIRECT;replace;https://docs.google.com/document/d/test/edit;307;");
});

test("failed export returns to the note with its error", async () => {
  const action = exportAction(async () => { throw new Error("Export unavailable"); });
  const form = new FormData();
  form.set("patientId", "test");
  await assert.rejects(action(form), error => error.digest.includes("/patients/test/summary-note?export=error&message=Export%20unavailable"));
});
