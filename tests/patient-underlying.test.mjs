import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import ts from "typescript";

function loadSource(relative, overrides = {}, cache = new Map()) {
  const filename = path.resolve(relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = { exports: {} }; cache.set(filename, loaded);
  const nativeRequire = Module.createRequire(filename);
  const requireSource = name => {
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

function setup({ underlying = "DM", race = false } = {}) {
  const patient = { id: "p1", ward_id: "w1", lifecycle: "active", underlying_disease: underlying, diagnosis: "original diagnosis" };
  const updates = [], logs = [], revalidated = [];
  const client = { from(table) {
    const filters = []; let payload;
    const query = {
      select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
      is(key, value) { filters.push([key, value]); return query; },
      update(value) { payload = value; return query; },
      async insert(value) { assert.equal(table, "activity_logs"); logs.push(value); return { error: null }; },
      async maybeSingle() {
        assert.equal(table, "patients");
        if (!payload) return { data: { ...patient }, error: null };
        updates.push({ payload, filters });
        if (race) patient.underlying_disease = "other editor";
        if (!filters.every(([key, value]) => patient[key] === value)) return { data: null, error: null };
        Object.assign(patient, payload); return { data: { underlying_disease: patient.underlying_disease }, error: null };
      },
    };
    return query;
  } };
  const { autosaveUnderlyingDisease } = loadSource("src/lib/wardflow.ts", {
    "next/cache": { revalidatePath: route => revalidated.push(route) },
    "@/lib/env": { hasLiveSupabase: () => true },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => client },
    "@/lib/google-docs": {},
  });
  const session = { mode: "live", profile: { id: "doctor", role: "resident", name: "Doctor", residentWardIds: ["w1"] } };
  const save = (input = {}, actor = session) => autosaveUnderlyingDisease({ patientId: "p1", expectedValue: underlying, note: "HT\nCKD", ...input }, actor);
  return { patient, updates, logs, revalidated, session, save };
}

test("U/D saves exact multiline text with an atomic field check and leaves other patient data intact", async () => {
  const h = setup(); assert.deepEqual(await h.save(), { ok: true, value: "HT\nCKD" });
  assert.equal(h.patient.diagnosis, "original diagnosis");
  assert.deepEqual(h.updates[0].payload, { underlying_disease: "HT\nCKD", updated_by_id: "doctor" });
  assert.deepEqual(h.updates[0].filters, [["id", "p1"], ["ward_id", "w1"], ["lifecycle", "active"], ["underlying_disease", "DM"]]);
  assert.equal(h.logs.length, 1); assert(h.revalidated.includes("/patients/p1/summary-note"));
});
test("null U/D and clearing U/D use the same persisted field", async () => {
  const empty = setup({ underlying: null }); assert((await empty.save()).ok);
  assert.deepEqual(empty.updates[0].filters.at(-1), ["underlying_disease", null]);
  const h = setup(); assert.deepEqual(await h.save({ note: "" }), { ok: true, value: null });
});
test("student, unassigned resident, discharged patient and invalid input cannot save U/D", async () => {
  for (const role of ["student", "unknown"]) {
    const h = setup(); const result = await h.save({}, { ...h.session, profile: { ...h.session.profile, role } });
    assert.equal(result.retryable, false); assert.equal(h.updates.length, 0);
  }
  const h = setup(); h.session.profile.residentWardIds = []; assert.equal((await h.save()).retryable, false);
  h.session.profile.role = "admin"; h.patient.lifecycle = "discharged"; assert.equal((await h.save()).retryable, false);
  assert.equal((await h.save({ note: 42 })).retryable, false); assert.equal(h.updates.length, 0);
});
test("stale and concurrently changed U/D are never overwritten", async () => {
  const stale = setup(); assert.equal((await stale.save({ expectedValue: "stale" })).conflict, true); assert.equal(stale.updates.length, 0);
  const race = setup({ race: true }); assert.equal((await race.save()).conflict, true); assert.equal(race.patient.underlying_disease, "other editor");
});
test("a lost-response retry is acknowledged without a duplicate update or audit log", async () => {
  const h = setup(); await h.save(); assert.deepEqual(await h.save(), { ok: true, value: "HT\nCKD" });
  assert.equal(h.updates.length, 1); assert.equal(h.logs.length, 1);
});
test("draft acknowledgements preserve newer typing and ignore obsolete request responses", () => {
  const d = loadSource("src/lib/underlying-draft.ts"); const key = d.underlyingDraftKey("u1", "p1");
  const request = { patientId: "p1", expectedValue: "DM", note: "sent", requestId: "r1" };
  d.writeUnderlyingDraft(key, { note: "newer typing", base: "DM", request });
  d.acknowledgeUnderlyingDraft(key, "old", "old response"); assert.equal(d.readUnderlyingDraft(key).request.requestId, "r1");
  d.acknowledgeUnderlyingDraft(key, "r1", "sent"); assert.deepEqual(d.readUnderlyingDraft(key), { note: "newer typing", base: "sent", request: null });
  assert(d.hasUnderlyingDrafts()); d.clearUnderlyingDrafts(); assert.equal(d.readUnderlyingDraft(key), null);
});
