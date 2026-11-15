import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createClinicalCodec, protectedColumns } from "../src/lib/server/clinical-crypto.mjs";
import { testConfig } from "./helpers/clinical-harness.mjs";

// Opt-in test-only Postgres WASM runtime, installed outside application dependencies.
const { PGlite } = createRequire(import.meta.url)(process.env.PGLITE_MODULE || "@electric-sql/pglite");
let db;
const codec = createClinicalCodec(testConfig());
const ids = {
  patient: "11111111-1111-4111-8111-111111111111", problem: "22222222-2222-4222-8222-222222222222",
  doctor: "33333333-3333-4333-8333-333333333333", ward: "44444444-4444-4444-8444-444444444444",
  destination: "55555555-5555-4555-8555-555555555555",
};
const migration = readFileSync(new URL("../supabase/migrations/20261115173915_enforce_clinical_ciphertext.sql", import.meta.url), "utf8");

before(async () => {
  db = new PGlite();
  for (const [table, columns] of Object.entries(protectedColumns)) {
    const primaryType = ["patients", "problems"].includes(table) ? "uuid" : "text";
    const extra = table === "patients" ? ", ward_id uuid, bed text, lifecycle text default 'active', updated_by_id uuid, updated_at timestamptz default now()" :
      table === "problems" ? ", patient_id uuid, updated_by_id uuid, updated_at timestamptz default now()" :
      table === "problem_progress_entries" ? ", problem_id uuid unique, author_id uuid, date_time timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()" :
      table === "activity_logs" ? ", patient_id uuid, actor_id uuid, actor_name text, action text, entity_type text, entity_id text" : "";
    await db.exec(`create table public.${table} (id ${primaryType} primary key${table === "activity_logs" ? " default gen_random_uuid()::text" : ""}, ${columns.map(column => `${column} ${table === "activity_logs" ? "jsonb" : "text"}`).join(",")}${extra});`);
  }
  await db.exec(`
    create schema auth;
    create role anon; create role authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.can_write_patient_core_ward_uuid(uuid) returns boolean language sql stable as $$ select current_setting('test.authorized', true) = 'true' $$;
    create table public.wards(id uuid primary key, is_active boolean);
    create table public.profiles(id uuid primary key, name text);
    select set_config('test.uid', '${ids.doctor}', false);
    select set_config('test.authorized', 'true', false);
    insert into wards values ('${ids.ward}',true),('${ids.destination}',true);
    insert into profiles values ('${ids.doctor}','Synthetic doctor');
  `);
  // Existing plaintext must be allowed to remain only until the maintenance backfill.
  await db.query("insert into patients(id,ward_id,bed,hospital_number,display_name) values($1,$2,'before','000001','สมมติ')", [ids.patient, ids.ward]);
  await db.exec("begin;" + migration + "commit;");
});

after(async () => { await db?.close(); });

test("actual Postgres migration blocks new plaintext writes and permits an encrypted backfill", async () => {
  await assert.rejects(db.query("insert into patients(id,display_name,hospital_number) values(gen_random_uuid(),'สมมติ','0012345')"), /wf_enc_/);
  const patient = { id: ids.patient, display_name: "ผู้ป่วยสมมติ", hospital_number: "0012345", diagnosis: "สมมติ" };
  const encrypted = codec.encryptRow("patients", patient);
  await db.query("update patients set hospital_number=$1,display_name=$2,diagnosis=$3 where id=$4", [encrypted.hospital_number, encrypted.display_name, encrypted.diagnosis, ids.patient]);
  const stored = (await db.query("select * from patients where id=$1", [ids.patient])).rows[0];
  assert.equal(codec.decryptRow("patients", stored).hospital_number, patient.hospital_number);
  await db.query("insert into problems(id,patient_id,title) values($1,$2,$3)", [ids.problem, ids.patient, codec.encryptValue("problems", ids.problem, "title", "โรคสมมติ")]);
});

test("Postgres audit constraints reject missing/null marker tricks and mixed plaintext snapshots", async () => {
  for (const value of [{}, { __wardflow_encrypted: null }, { __wardflow_encrypted: "plaintext" },
    { id: ids.patient, display_name: "wfphi:1:AAAA", hospital_number: "0012345" }, "plain", []]) {
    await assert.rejects(db.query("insert into activity_logs(entity_type,entity_id,after_json) values('patient',$1,$2)", [ids.patient, JSON.stringify(value)]), /wf_enc_/);
  }
  const row = codec.encryptRow("activity_logs", { id: "synthetic-log", after_json: { hospitalNumber: "0012345" } });
  await db.query("insert into activity_logs(id,after_json) values($1,$2)", [row.id, JSON.stringify(row.after_json)]);
});

test("the actual transfer_patient SQL copies encrypted data and strict decoding preserves original HN", async () => {
  await db.exec(readFileSync(new URL("../supabase/migrations/20260802170143_harden_patient_transfer_safety.sql", import.meta.url), "utf8"));
  const transferred = await db.query("select public.transfer_patient($1,$2,$3,null)", [ids.patient, ids.destination, "new-bed"]);
  assert.equal(transferred.rows[0].transfer_patient, ids.patient);
  const audit = (await db.query("select * from activity_logs where action='patient.transferred'")).rows[0];
  assert.notEqual(audit.after_json.hospital_number, "0012345");
  const decoded = codec.decryptRow("activity_logs", audit);
  assert.equal(decoded.after_json.hospital_number, "0012345");
  assert.equal(decoded.before_json.hospital_number, "0012345");
  assert.equal(decoded.after_json.ward_id, ids.destination);
});

test("actual autosave SQL accepts ciphertext, preserves conflict checks and exposes retry ciphertext mismatch", async () => {
  const source = readFileSync(new URL("../supabase/migrations/20261025232002_keep_only_current_progress_note.sql", import.meta.url), "utf8");
  await db.exec(source.slice(source.indexOf("create or replace function public.autosave_problem_note(")));
  const requestId = "synthetic-request-1";
  const note = "บรรทัดสมมติ\n• ตัวอย่าง";
  const sealed = codec.encryptValue("problem_progress_entries", ids.problem, "note", note);
  const query = "select public.autosave_problem_note($1::uuid,$2::uuid,$3::text,$4::text,$5::timestamptz,$6::text) as saved";
  const first = (await db.query(query, [ids.patient, ids.problem, requestId, null, null, sealed])).rows[0].saved;
  assert.equal(first.ok, true);
  assert.equal(codec.decryptValue("problem_progress_entries", ids.problem, "note", first.snapshot.note), note);
  const same = (await db.query(query, [ids.patient, ids.problem, requestId, null, null, sealed])).rows[0].saved;
  assert.equal(same.snapshot.id, requestId);
  const reencrypted = codec.encryptValue("problem_progress_entries", ids.problem, "note", note);
  await assert.rejects(db.query(query, [ids.patient, ids.problem, requestId, null, null, reencrypted]), /Invalid retry/);
  const stale = (await db.query(query, [ids.patient, ids.problem, "stale-request", null, null, reencrypted])).rows[0].saved;
  assert.equal(stale.conflict, true);
  await db.exec("select set_config('test.authorized','false',false)");
  await assert.rejects(db.query(query, [ids.patient, ids.problem, "denied", null, null, reencrypted]), /Ward access denied/);
  await db.exec("select set_config('test.authorized','true',false)");
});

test("every added ciphertext constraint validates after backfill and migration is repeatable", async () => {
  const constraints = await db.query("select n.nspname,c.relname,p.conname from pg_constraint p join pg_class c on p.conrelid=c.oid join pg_namespace n on n.oid=c.relnamespace where p.conname like 'wf_enc_%'");
  assert.equal(constraints.rows.length, Object.values(protectedColumns).flat().length);
  for (const row of constraints.rows) await db.exec(`alter table ${row.nspname}.${row.relname} validate constraint ${row.conname}`);
  await db.exec("begin;" + migration + "commit;");
  const invalid = await db.query("select conname from pg_constraint where conname like 'wf_enc_%' and not convalidated");
  assert.equal(invalid.rows.length, 0);
});
