import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { createClinicalCodec, clinicalConfigFromEnv, ClinicalEncryptionError, protectedColumns } from "../src/lib/server/clinical-crypto.mjs";
import { migrateClinicalEncryption } from "../scripts/migrate-clinical-encryption.mjs";
import { clinicalHarness, testConfig } from "./helpers/clinical-harness.mjs";
import { loadSource } from "./helpers/load-source.mjs";

const { displayHospitalNumber } = loadSource("src/lib/hospital-number.ts");

test("display-only HN rotation handles digits, leading zeros and letter prefixes without changing raw values", () => {
  for (const [raw, display] of [["1234567", "34567-12"], ["0012345", "12345-00"], ["HN6600012", "6600012-HN"],
    ["AB-001", "-001-AB"], ["12", "12"], ["1", "1"], ["", ""], [null, ""], [undefined, ""]]) {
    assert.equal(displayHospitalNumber(raw), display);
  }
});

test("production codec round-trips 10,000 HNs exactly through serialized database rows", () => {
  const codec = createClinicalCodec(testConfig());
  for (let index = 0; index < 10_000; index++) {
    const row = { id: `synthetic-${index}`, hospital_number: String(index).padStart(10, "0"), display_name: `ชื่อสมมติ ${index}` };
    const stored = JSON.parse(JSON.stringify(codec.encryptRow("patients", row)));
    assert.deepEqual(codec.decryptRow("patients", stored), row);
  }
});

test("live configuration fails closed for missing/malformed keys and never exposes key values", () => {
  const secret = randomBytes(32).toString("base64");
  for (const env of [{}, { WARDFLOW_ENCRYPTION_KEYS: secret },
    { WARDFLOW_ENCRYPTION_KEY_ID: "key1", WARDFLOW_ENCRYPTION_KEYS: JSON.stringify({ key1: "short" }) }]) {
    assert.throws(() => clinicalConfigFromEnv(env), error => !error.message.includes(secret) && /blocked/.test(error.message));
  }
  const config = clinicalConfigFromEnv({ WARDFLOW_ENCRYPTION_KEY_ID: "key1", WARDFLOW_ENCRYPTION_KEYS: JSON.stringify({ key1: secret }) });
  assert.equal(config.allowLegacyReads, false);
  assert.equal(config.keys.get("key1").length, 32);
});

test("strict reads reject plaintext, numeric HNs, unknown keys and tampered/mispaired ciphertext", () => {
  const config = testConfig();
  const codec = createClinicalCodec(config);
  const row = { id: "p1", hospital_number: "0001234", display_name: "ชื่อสมมติ" };
  const sealed = codec.encryptRow("patients", row);
  assert.throws(() => codec.encryptRow("patients", { ...row, hospital_number: 1234 }), ClinicalEncryptionError);
  assert.throws(() => codec.decryptRow("patients", row), ClinicalEncryptionError);
  assert.throws(() => codec.decryptRow("patients", { ...sealed, id: "p2" }), ClinicalEncryptionError);
  assert.throws(() => codec.decryptRow("patients", { ...sealed, display_name: sealed.hospital_number }), ClinicalEncryptionError);
  const otherKey = createClinicalCodec(testConfig());
  assert.throws(() => otherKey.decryptRow("patients", sealed), ClinicalEncryptionError);
  const corrupt = sealed.hospital_number.slice(0, -8) + "AAAAAAAA";
  assert.throws(() => codec.decryptRow("patients", { ...sealed, hospital_number: corrupt }), ClinicalEncryptionError);
  for (const part of ["iv", "ciphertext", "tag"]) {
    const envelope = JSON.parse(Buffer.from(sealed.hospital_number.slice("wfphi:1:".length), "base64").toString("utf8"));
    const bytes = Buffer.from(envelope[part], "base64");
    bytes[0] ^= 1;
    envelope[part] = bytes.toString("base64");
    const token = "wfphi:1:" + Buffer.from(JSON.stringify(envelope)).toString("base64");
    assert.throws(() => codec.decryptRow("patients", { ...sealed, hospital_number: token }), ClinicalEncryptionError);
  }
  for (const invalid of ["wfphi:1:garbage", "wfphi:2:AAAA", "wfphi:1:"]) {
    const transition = createClinicalCodec({ ...config, allowLegacyReads: true });
    assert.throws(() => transition.decryptRow("patients", { ...row, hospital_number: invalid }), ClinicalEncryptionError);
  }
});

test("all configured clinical columns encrypt Unicode, multiline, empty text and JSON audit snapshots", () => {
  const codec = createClinicalCodec(testConfig());
  for (const [table, columns] of Object.entries(protectedColumns)) {
    const row = { id: "synthetic-id", problem_id: "synthetic-problem" };
    for (const column of columns) row[column] = table === "activity_logs" ? { hospitalNumber: "0012345", name: "ชื่อสมมติ 👩🏽‍⚕️" } : "ข้อความสมมติ\r\n• ข้อย่อย 👩🏽‍⚕️\u0000";
    assert.deepEqual(codec.decryptRow(table, JSON.parse(JSON.stringify(codec.encryptRow(table, row)))), row);
    for (const column of columns) {
      const empty = { ...row, [column]: table === "activity_logs" ? {} : "" };
      assert.deepEqual(codec.decryptRow(table, codec.encryptRow(table, empty)), empty);
      const nulled = { ...row, [column]: null };
      assert.deepEqual(codec.decryptRow(table, codec.encryptRow(table, nulled)), nulled);
    }
  }
});

test("large notes round-trip and oversized input is rejected before a write", () => {
  const codec = createClinicalCodec(testConfig());
  const row = { id: "large-note", note: "x".repeat(1_000_000) };
  assert.deepEqual(codec.decryptRow("ward_tasks", codec.encryptRow("ward_tasks", row)), row);
  assert.throws(() => codec.encryptRow("ward_tasks", { ...row, note: "x".repeat(4 * 1024 * 1024) }), ClinicalEncryptionError);
});

test("SQL-created transfer snapshots decode without allowing plaintext HN/name in strict mode", () => {
  const codec = createClinicalCodec(testConfig());
  const patient = { id: "p1", hospital_number: "0012345", display_name: "ชื่อสมมติ", diagnosis: "สมมติ", bed: "1" };
  const stored = codec.encryptRow("patients", patient);
  const audit = { id: "log1", entity_type: "patient", entity_id: "p1", before_json: stored, after_json: { ...stored, bed: "2" } };
  const restored = codec.decryptRow("activity_logs", audit);
  assert.equal(restored.before_json.hospital_number, patient.hospital_number);
  assert.equal(restored.after_json.bed, "2");
  assert.throws(() => codec.decryptRow("activity_logs", { ...audit, before_json: { ...stored, hospital_number: "0012345" } }), ClinicalEncryptionError);
});

test("authenticated audit text that resembles a ciphertext marker is retained literally", () => {
  const codec = createClinicalCodec(testConfig());
  const audit = { id: "literal-log", entity_type: "patient", entity_id: "p1", before_json: null,
    after_json: { id: "p1", hospital_number: "wfphi:1:literal-not-an-envelope", display_name: "สมมติ" } };
  assert.deepEqual(codec.decryptRow("activity_logs", codec.encryptRow("activity_logs", audit)), audit);
});

test("actual Supabase SDK sends ciphertext and returns raw HN to application callers", async () => {
  const h = clinicalHarness();
  const row = { id: "p1", hospital_number: "0012345", display_name: "ผู้ป่วยสมมติ", diagnosis: "สมมติ", underlying_disease: "DM" };
  assert.equal((await h.client.from("patients").insert(row)).error, null);
  assert.notEqual(h.tables.patients[0].hospital_number, row.hospital_number);
  const result = await h.client.from("patients").select("hospital_number,display_name").eq("id", "p1").maybeSingle();
  assert.equal(result.error, null);
  assert.equal(result.data.hospital_number, row.hospital_number);
  assert.equal(result.data.display_name, row.display_name);
  assert(h.calls.at(-1).url.includes("%2Cid"));
  const protectedWrite = h.calls.find(call => call.method === "POST");
  assert(!JSON.stringify(protectedWrite.body).includes(row.display_name));
});

test("U/D CAS filters use the original ciphertext and preserve conflict/lost-response behavior", async () => {
  const h = clinicalHarness();
  await h.client.from("patients").insert({ id: "p1", ward_id: "w1", lifecycle: "active", underlying_disease: "DM", hospital_number: "0012345", display_name: "สมมติ", diagnosis: "เดิม" });
  const input = { patientId: "p1", expectedValue: "DM", note: "HT\nCKD" };
  assert.deepEqual(await h.api.autosaveUnderlyingDisease(input, h.session), { ok: true, value: input.note });
  const mutation = h.calls.find(call => call.method === "PATCH" && new URL(call.url).searchParams.has("underlying_disease"));
  assert(new URL(mutation.url).searchParams.get("underlying_disease").startsWith("eq.wfphi:1:"));
  assert(!mutation.url.includes("eq.DM"));
  const count = h.calls.filter(call => call.method === "PATCH").length;
  assert.deepEqual(await h.api.autosaveUnderlyingDisease(input, h.session), { ok: true, value: input.note });
  assert.equal(h.calls.filter(call => call.method === "PATCH").length, count);
  assert.equal((await h.api.autosaveUnderlyingDisease({ ...input, note: "stale edit" }, h.session)).conflict, true);
  assert.equal(h.codec.decryptRow("patients", h.tables.patients[0]).hospital_number, "0012345");
  assert.equal(typeof h.tables.activity_logs[0].before_json.__wardflow_encrypted, "string");
});

test("actual admit -> encrypted rows/logs -> patient bundle -> Summary Note preserves original HN/name", async () => {
  const h = clinicalHarness();
  const form = new FormData();
  for (const [field, value] of Object.entries({ wardId: "w1", bed: "99", hospitalNumber: "0012345", admissionNumber: "AN001", displayName: "ผู้ป่วยสมมติ ทดสอบ", age: "42", sex: "Male", diagnosis: "โรคสมมติ", status: "stable", precaution: "none", underlyingDisease: "DM\nHT" })) form.set(field, value);
  const patientId = await h.api.savePatient(form, h.session);
  const stored = h.tables.patients.find(row => row.id === patientId);
  assert.notEqual(stored.hospital_number, "0012345");
  assert.notEqual(stored.display_name, "ผู้ป่วยสมมติ ทดสอบ");
  assert(h.tables.activity_logs.every(row => row.after_json === null || row.after_json.__wardflow_encrypted));
  const bundle = await h.api.getPatientBundle(h.session, patientId);
  assert.equal(bundle.patient.hospitalNumber, "0012345");
  assert.equal(displayHospitalNumber(bundle.patient.hospitalNumber), "12345-00");
  const payload = await h.api.getSummaryNotePayloadByPatientId(h.session, patientId);
  assert(payload.plainText.includes("0012345"));
  assert(!payload.plainText.includes("12345-00"));
  assert(payload.plainText.includes("ผู้ป่วยสมมติ ทดสอบ"));
  form.set("id", patientId);
  form.set("hospitalNumber", "HN6600012");
  form.set("updatedAt", stored.updated_at);
  await h.api.savePatient(form, h.session);
  assert.equal((await h.api.getPatientBundle(h.session, patientId)).patient.hospitalNumber, "HN6600012");
});

test("encrypted Progress RPC recovers committed retries and rejects stale/changed requests", async () => {
  const h = clinicalHarness();
  await h.client.from("patients").insert({ id: "p1", ward_id: "w1", lifecycle: "active", display_name: "สมมติ", diagnosis: "สมมติ" });
  const request = { patientId: "p1", problemId: "problem1", requestId: "11111111-1111-4111-8111-111111111111", expectedId: null, expectedUpdatedAt: null, note: "บรรทัดสมมติ\n• note" };
  const first = await h.api.autosaveProblemNote(request, h.session);
  assert.equal(first.ok, true);
  assert.equal(first.snapshot.note, request.note);
  const retry = await h.api.autosaveProblemNote(request, h.session);
  assert.deepEqual(retry, first);
  assert.equal(h.tables.problem_progress_entries.length, 1);
  assert.notEqual(h.tables.problem_progress_entries[0].note, request.note);
  assert.equal((await h.api.autosaveProblemNote({ ...request, note: "changed reuse" }, h.session)).ok, false);
  const conflict = await h.api.autosaveProblemNote({ ...request, requestId: "22222222-2222-4222-8222-222222222222" }, h.session);
  assert.equal(conflict.conflict, true);
});

test("migration dry-run does not write; apply and strict verify preserve all HNs and audit payloads", async () => {
  const config = { ...testConfig(), allowLegacyReads: true };
  const h = clinicalHarness(config);
  const original = { id: "p1", hospital_number: "0012345", display_name: "สมมติ", diagnosis: "สมมติ", updated_at: "2026-01-01T00:00:00.000Z" };
  h.tables.patients.push(structuredClone(original));
  h.tables.activity_logs.push({ id: "log1", entity_type: "patient", entity_id: "p1", before_json: null, after_json: { ...original } });
  const before = JSON.stringify(h.tables);
  const dry = await migrateClinicalEncryption(h.rawClient, h.codec, { pageSize: 1 });
  assert.equal(dry.patients.legacy, 1);
  assert.equal(JSON.stringify(h.tables), before);
  const applied = await migrateClinicalEncryption(h.rawClient, h.codec, { apply: true });
  assert.equal(applied.patients.updated, 1);
  assert.equal(applied.activity_logs.updated, 1);
  assert.equal(h.codec.decryptRow("patients", h.tables.patients[0]).hospital_number, original.hospital_number);
  const strict = createClinicalCodec({ ...config, allowLegacyReads: false });
  h.tables.activity_logs.push({ id: "sql-log", entity_type: "patient", entity_id: "p1", before_json: { ...h.tables.patients[0] }, after_json: { ...h.tables.patients[0] } });
  const verified = await migrateClinicalEncryption(h.rawClient, strict, { verifyOnly: true });
  assert.equal(verified.patients.legacy, 0);
  assert.equal(h.codec.decryptRow("activity_logs", h.tables.activity_logs[0]).after_json.hospital_number, original.hospital_number);
});

test("health never reports ready with missing encryption keys or legacy-read mode", async () => {
  for (const configuration of [() => { throw new Error("synthetic-secret-must-not-leak"); }, () => ({ allowLegacyReads: true })]) {
    let adminOpened = false;
    const { GET } = loadSource("src/app/api/health/route.ts", {
      "@/lib/env": { getRequestOrigin: () => "https://synthetic.invalid", getSupabasePublicEnv: () => ({}), getSupabaseServiceRoleKey: () => "synthetic", hasLiveSupabase: () => true },
      "@/lib/server/clinical-crypto.mjs": { clinicalConfigFromEnv: configuration },
      "@/lib/supabase/server": { createAdminSupabaseClient: () => { adminOpened = true; } },
    });
    const response = await GET(new Request("https://synthetic.invalid/api/health"));
    assert.equal(response.status, 503);
    assert.equal(adminOpened, false);
    assert(!(await response.text()).includes("synthetic-secret-must-not-leak"));
  }
});
