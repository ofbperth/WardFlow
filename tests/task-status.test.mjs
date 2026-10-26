import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const compiled = ts.transpileModule(fs.readFileSync(new URL("../src/lib/utils.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const loaded = { exports: {} };
new Function("require", "module", "exports", compiled)(createRequire(import.meta.url), loaded, loaded.exports);
const { nextTaskCycleStatus, normalizeTaskStatus, labelForTaskStatus } = loaded.exports;

for (const type of ["lab", "imaging", "consult", "procedure", "family_talk", "discharge", "medication", "other"]) {
  test(`${type}: permitted cycle and legacy status reset`, () => {
    const hasProgress = type === "lab" || type === "imaging";
    assert.equal(nextTaskCycleStatus("not_started", type), hasProgress ? "in_progress" : "done");
    assert.equal(nextTaskCycleStatus("in_progress", type), "done");
    assert.equal(nextTaskCycleStatus("done", type), "not_started");
    assert.equal(normalizeTaskStatus("blocked", type), "not_started");
    assert.equal(normalizeTaskStatus("in_progress", type), hasProgress ? "in_progress" : "not_started");
    assert.equal(normalizeTaskStatus("done", type), "done");
    assert.equal(normalizeTaskStatus("not_started", type), "not_started");
  });
}
test("Not start display label", () => assert.equal(labelForTaskStatus("not_started"), "Not start"));
