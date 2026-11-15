import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { DecryptionError, openRecord, openText, protectedFields, sealRecord, sealText } from "./prototype.mjs";

const scopeId = "synthetic-team-only";
const key = randomBytes(32);
const config = { keyId: "test-key-v1", key };
const keyring = new Map([[config.keyId, key]]);
const context = { scopeId, patientId: "synthetic-patient-1", field: "hospitalNumber" };

function syntheticPatient(index = 1) {
  return {
    id: `synthetic-patient-${index}`, hospitalNumber: String(index).padStart(10, "0"),
    admissionNumber: `AN-00${index}/69`, displayName: `ผู้ป่วยสมมติ ${index} ทดสอบเท่านั้น`,
    underlyingDisease: "#โรคสมมติ\n• ข้อความทดสอบ 👩🏽‍⚕️\n  • ไม่มีข้อมูลคนไข้จริง",
    diagnosis: "Synthetic diagnosis only",
  };
}

function assertBlocked(fn) {
  assert.throws(fn, error => error instanceof DecryptionError &&
    error.message === "Encrypted patient data could not be verified");
}

test("exact HN round-trip: leading zeros, separators, long numbers and whitespace", () => {
  for (const value of ["0", "0000000", "0012345", "12/0069", "AB-000012", "๑๒๓๔๕", " 00123 ",
    "90071992547409931234567890", "00001\n", "", null]) {
    const envelope = sealText(value, context, config);
    assert.equal(openText(JSON.parse(JSON.stringify(envelope)), context, keyring), value);
  }
});

test("10,000 synthetic HNs remain exact after JSON storage; each nonce is distinct", t => {
  const seen = new Set();
  for (let index = 0; index < 10_000; index++) {
    const value = String(index).padStart(10, "0");
    const currentContext = { ...context, patientId: `synthetic-${index}` };
    const envelope = sealText(value, currentContext, config);
    assert.equal(openText(JSON.parse(JSON.stringify(envelope)), currentContext, keyring), value);
    assert(!seen.has(envelope.iv));
    seen.add(envelope.iv);
  }
  t.diagnostic("10,000 synthetic HNs: exact round-trips, zero mismatches; nonce uniqueness observed in this sample");
});

test("Thai names, combining marks, emoji, null, empty and multiline notes remain exact", () => {
  for (const value of ["ผู้ป่วยสมมติ กำลังทดสอบ", "ก\u0e49\u0e33", "é", "e\u0301", "👩🏽‍⚕️", "\ud800",
    "a\u0000b", "\tชื่อสมมติ\r\n• บรรทัด 2\n", "", null, "ทดสอบ".repeat(10_000)]) {
    const fieldContext = { ...context, field: "displayName" };
    assert.equal(openText(sealText(value, fieldContext, config), fieldContext, keyring), value);
  }
});

test("numbers, undefined, objects and booleans are rejected instead of silently changing HNs", () => {
  for (const value of [12345, 0, Number.NaN, undefined, {}, [], false, 123n]) {
    assert.throws(() => sealText(value, context, config), TypeError);
  }
  assert.throws(() => sealText("001", context, { ...config, key: Buffer.alloc(16) }), TypeError);
});

test("same input encrypts differently but decrypts to the identical HN", () => {
  const first = sealText("0012345", context, config);
  const second = sealText("0012345", context, config);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.equal(openText(first, context, keyring), openText(second, context, keyring));
});

test("wrong or missing keys fail closed, with no partial HN returned", () => {
  const envelope = sealText("0012345", context, config);
  assertBlocked(() => openText(envelope, context, new Map([[config.keyId, randomBytes(32)]])));
  assertBlocked(() => openText(envelope, context, new Map()));
  assertBlocked(() => openText(envelope, context, new Map([[config.keyId, Buffer.alloc(1)]])));
});

test("every single-bit mutation of IV, ciphertext and authentication tag is rejected", t => {
  const envelope = sealText("0012345", context, config);
  let rejected = 0;
  for (const field of ["iv", "ciphertext", "tag"]) {
    const original = Buffer.from(envelope[field], "base64");
    for (let byte = 0; byte < original.length; byte++) {
      for (let bit = 0; bit < 8; bit++) {
        const modified = Buffer.from(original);
        modified[byte] ^= 1 << bit;
        assertBlocked(() => openText({ ...envelope, [field]: modified.toString("base64") }, context, keyring));
        rejected++;
      }
    }
  }
  t.diagnostic(`${rejected} single-bit corruptions rejected; no plaintext returned`);
});

test("patient, field and team substitutions are rejected", () => {
  const envelope = sealText("0012345", context, config);
  for (const override of [{ patientId: "other-patient" }, { field: "admissionNumber" }, { scopeId: "other-team" }]) {
    assertBlocked(() => openText(envelope, { ...context, ...override }, keyring));
  }
  // Context serialization cannot be confused by moving a delimiter between IDs.
  const delimiterContext = { ...context, scopeId: "team:patient", patientId: "one" };
  const otherContext = { ...context, scopeId: "team", patientId: "patient:one" };
  assertBlocked(() => openText(sealText("001", delimiterContext, config), otherContext, keyring));
});

test("malformed, truncated, unexpected metadata and plaintext fallback inputs are rejected", () => {
  const envelope = sealText("0012345", context, config);
  for (const invalid of [null, [], "0012345", {}, { ...envelope, version: 2 },
    { ...envelope, algorithm: "aes-256-cbc" }, { ...envelope, plaintext: "0012345" },
    { ...envelope, keyId: "unknown" }, { ...envelope, tag: "" }, { ...envelope, ciphertext: "%%%" },
    { ...envelope, iv: envelope.iv + " " }, { ...envelope, ciphertext: envelope.ciphertext.slice(4) },
    { ...envelope, tag: Buffer.alloc(12).toString("base64") }]) {
    assertBlocked(() => openText(invalid, context, keyring));
  }
  const aliasRing = new Map([...keyring, ["alias", key]]);
  assertBlocked(() => openText({ ...envelope, keyId: "alias" }, context, aliasRing));
});

test("key rotation supports both versions; unavailable old key never falls back", () => {
  const next = { keyId: "test-key-v2", key: randomBytes(32) };
  const ring = new Map([...keyring, [next.keyId, next.key]]);
  const oldEnvelope = sealText("0012345", context, config);
  const newEnvelope = sealText(openText(oldEnvelope, context, ring), context, next);
  assert.equal(openText(newEnvelope, context, ring), "0012345");
  assert.equal(openText(oldEnvelope, context, ring), "0012345");
  ring.delete(config.keyId);
  assertBlocked(() => openText(oldEnvelope, context, ring));
  assert.equal(openText(newEnvelope, context, ring), "0012345");
});

test("a stored encrypted record has no extra plaintext fields and preserves all protected values", () => {
  const patient = syntheticPatient();
  const row = JSON.parse(JSON.stringify(sealRecord(patient, scopeId, config)));
  assert.deepEqual(Object.keys(row).sort(), ["fields", "id"]);
  for (const field of protectedFields) assert.equal(typeof row.fields[field], "object");
  assert.deepEqual(openRecord(row, scopeId, patient.id, keyring),
    Object.fromEntries(protectedFields.map(field => [field, patient[field]])));
});

test("swapping fields or records across patients blocks the entire decrypted result", () => {
  const first = sealRecord(syntheticPatient(1), scopeId, config);
  const second = sealRecord(syntheticPatient(2), scopeId, config);
  const mixed = structuredClone(second);
  mixed.fields.hospitalNumber = first.fields.hospitalNumber;
  assertBlocked(() => openRecord(mixed, scopeId, second.id, keyring));
  assertBlocked(() => openRecord(first, scopeId, second.id, keyring));
  assertBlocked(() => openRecord({ ...first, id: second.id }, scopeId, second.id, keyring));
  const missing = structuredClone(first);
  delete missing.fields.displayName;
  assertBlocked(() => openRecord(missing, scopeId, first.id, keyring));
});

// A synthetic, in-memory staging exercise, NOT a database migration implementation.
function stageSyntheticMigration(source, corruptStage = rows => rows) {
  if (new Set(source.map(row => row.id)).size !== source.length) throw new Error("Duplicate patient ID");
  const staged = corruptStage(source.map(row => sealRecord(row, scopeId, config)));
  assert.equal(staged.length, source.length);
  for (let index = 0; index < source.length; index++) {
    assert.deepEqual(openRecord(staged[index], scopeId, source[index].id, keyring),
      Object.fromEntries(protectedFields.map(field => [field, source[index][field]])));
  }
  return staged;
}

test("staging 1,000 synthetic patient records validates every field without changing source", t => {
  const source = Array.from({ length: 1_000 }, (_, index) => syntheticPatient(index));
  const before = JSON.stringify(source);
  const staged = stageSyntheticMigration(source);
  assert.equal(JSON.stringify(source), before);
  assert.equal(staged.length, 1_000);
  t.diagnostic("1,000 synthetic records / 5,000 protected fields verified exactly; source remained unchanged");
});

test("damaged, mispaired and invalid migration candidates never replace source records", () => {
  let records = [syntheticPatient(1), syntheticPatient(2)];
  const before = structuredClone(records);
  assertBlocked(() => {
    records = stageSyntheticMigration(records, rows => {
      rows[1].fields.hospitalNumber = rows[0].fields.hospitalNumber;
      return rows;
    });
  });
  assert.deepEqual(records, before);
  assert.throws(() => stageSyntheticMigration([syntheticPatient(1), syntheticPatient(1)]), /Duplicate patient ID/);
  assert.throws(() => stageSyntheticMigration([{ ...syntheticPatient(1), hospitalNumber: 1 }]), TypeError);
  assert.deepEqual(records, before);
});

test("retry reuses the exact encrypted request; a concurrent new edit retains a distinct revision", () => {
  const snapshot = sealRecord(syntheticPatient(), scopeId, config);
  const request = { requestId: "synthetic-request-1", expectedRevision: 7, encrypted: snapshot };
  const persistedRequest = JSON.stringify(request);
  const accepted = { revision: 8, requestId: request.requestId, payload: persistedRequest };
  // Simulate a response lost after acceptance: resend the stored bytes, not a re-encryption.
  const retry = JSON.parse(persistedRequest);
  assert.equal(JSON.stringify(retry), accepted.payload);
  assert.equal(retry.requestId, accepted.requestId);
  assert.deepEqual(openRecord(retry.encrypted, scopeId, snapshot.id, keyring),
    openRecord(snapshot, scopeId, snapshot.id, keyring));
  // Existing production CAS must check revisions externally: encryption is not concurrency control.
  assert.notEqual(retry.expectedRevision, accepted.revision);
});

test("documented boundary: old valid ciphertext for the same field needs external replay protection", () => {
  const older = sealText("00001", context, config);
  const newer = sealText("00002", context, config);
  assert.equal(openText(newer, context, keyring), "00002");
  assert.equal(openText(older, context, keyring), "00001");
});

// Load actual pure WardFlow formatting code; no network adapters are executed.
function loadSource(relative, cache = new Map()) {
  const filename = fileURLToPath(new URL(`../../${relative}`, import.meta.url));
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = { exports: {} };
  cache.set(filename, loaded);
  const nativeRequire = createRequire(filename);
  const requireSource = name => name.startsWith("@/")
    ? loadSource(`src/${name.slice(2)}.ts`, cache) : nativeRequire(name);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", compiled)(requireSource, loaded, loaded.exports);
  return loaded.exports;
}

test("actual Summary Note/copy text and Google Docs requests are identical after decryption", () => {
  const { buildSummaryNotePayload } = loadSource("src/lib/summary-note.ts");
  const { buildGoogleDocsRequests } = loadSource("src/lib/google-docs.ts");
  const patient = { ...syntheticPatient(), age: 42 };
  const problems = [{ id: "synthetic-problem", problemName: "โรคสมมติ", priority: "ACTIVE_STABLE",
    resolvedAt: null, latestEntry: { note: "• บรรทัดทดสอบ\n  • ข้อย่อย" } }];
  const before = buildSummaryNotePayload({ patient, problems });
  const encrypted = JSON.parse(JSON.stringify(sealRecord(patient, scopeId, config)));
  const restored = { ...patient, ...openRecord(encrypted, scopeId, patient.id, keyring) };
  const after = buildSummaryNotePayload({ patient: restored, problems });
  assert.deepEqual(after, before);
  assert(after.plainText.includes(patient.hospitalNumber));
  assert(after.plainText.includes(patient.displayName));
  assert.deepEqual(buildGoogleDocsRequests(after), buildGoogleDocsRequests(before));
});
