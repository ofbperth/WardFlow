import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { createClinicalCodec, protectedColumns } from "../../src/lib/server/clinical-crypto.mjs";
import { loadSource } from "./load-source.mjs";

export const testConfig = () => ({ activeKeyId: "synthetic-v1", keys: new Map([["synthetic-v1", randomBytes(32)]]), allowLegacyReads: false });
const WebSocket = createRequire(import.meta.url)("next/dist/compiled/ws");

export function clinicalHarness(config = testConfig()) {
  const codec = createClinicalCodec(config);
  const { createClinicalFetch } = loadSource("src/lib/server/clinical-fetch.ts");
  const tables = Object.fromEntries([...Object.keys(protectedColumns), "wards", "profiles", "student_ward_assignments", "resident_ward_assignments", "task_templates"].map(table => [table, []]));
  const calls = [];
  let sequence = 0;
  const timestamp = () => new Date(Date.UTC(2026, 0, 1, 0, 0, ++sequence)).toISOString();
  const matches = (row, url) => [...url.searchParams].every(([column, filter]) => {
    if (filter.startsWith("eq.")) return String(row[column]) === filter.slice(3);
    if (filter === "is.null") return row[column] == null;
    if (filter.startsWith("in.(")) return filter.slice(4, -1).split(",").includes(String(row[column]));
    return true;
  });
  const respond = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  });
  const wire = async request => {
    const url = new URL(request.url);
    const body = ["POST", "PATCH"].includes(request.method) ? await request.json() : null;
    calls.push({ url: url.href, method: request.method, body: structuredClone(body) });
    if (url.pathname.endsWith("/rpc/autosave_problem_note")) {
      const existing = tables.problem_progress_entries.find(row => row.problem_id === body.p_problem_id);
      if (existing?.id === body.p_request_id) {
        if (existing.note !== body.p_note) return respond({ code: "P0001", message: "Invalid retry" }, 400);
      } else {
        if ((existing?.id ?? null) !== body.p_expected_id || (existing?.updated_at ?? null) !== body.p_expected_updated_at) {
          return respond({ ok: false, conflict: true, message: "Conflict" });
        }
        const saved = { id: body.p_request_id, problem_id: body.p_problem_id, author_id: "doctor", note: body.p_note, updated_at: timestamp() };
        tables.problem_progress_entries = tables.problem_progress_entries.filter(row => row.problem_id !== body.p_problem_id);
        tables.problem_progress_entries.push(saved);
      }
      const row = tables.problem_progress_entries.find(row => row.id === body.p_request_id);
      return respond({ ok: true, snapshot: { id: row.id, updatedAt: row.updated_at, note: row.note } });
    }
    const table = url.pathname.split("/").at(-1);
    if (!Object.hasOwn(tables, table)) throw new Error("Test forbids unknown network endpoints");
    let rows = tables[table].filter(row => matches(row, url));
    if (request.method === "POST") {
      rows = (Array.isArray(body) ? body : [body]).map(row => ({ lifecycle: "active", created_at: timestamp(), updated_at: timestamp(), ...row }));
      tables[table].push(...rows);
    } else if (request.method === "PATCH") {
      for (const row of rows) Object.assign(row, body, { updated_at: timestamp() });
    } else if (request.method === "DELETE") {
      tables[table] = tables[table].filter(row => !matches(row, url));
    }
    if (request.method !== "GET" && !request.headers.get("prefer")?.includes("return=representation")) return respond(null, 204);
    const offset = Number(url.searchParams.get("offset") || 0);
    const limit = Number(url.searchParams.get("limit") || rows.length);
    rows = rows.slice(offset, offset + limit);
    const selection = url.searchParams.get("select");
    if (selection && selection !== "*") rows = rows.map(row => Object.fromEntries(selection.split(",").map(column => [column, row[column] ?? null])));
    return respond(request.headers.get("accept")?.includes("object+json") ? rows[0] ?? null : rows);
  };
  const secureFetch = createClinicalFetch("https://synthetic.invalid", codec, wire);
  const client = createClient("https://synthetic.invalid", "synthetic-publishable-key", {
    realtime: { transport: WebSocket },
    global: { fetch: secureFetch }, auth: { persistSession: false, autoRefreshToken: false },
  });
  const rawClient = createClient("https://synthetic.invalid", "synthetic-service-key", {
    realtime: { transport: WebSocket },
    global: { fetch: (input, init) => wire(new Request(input, init)) }, auth: { persistSession: false, autoRefreshToken: false },
  });
  const session = { mode: "live", profile: { id: "doctor", role: "resident", name: "Synthetic doctor", residentWardIds: ["w1"], wardAssignment: null } };
  tables.wards.push({ id: "w1", name: "Synthetic ward", is_active: true });
  tables.profiles.push({ id: "doctor", name: "Synthetic doctor", role: "resident" });
  tables.resident_ward_assignments.push({ id: "assignment", resident_id: "doctor", ward_id: "w1" });
  const api = loadSource("src/lib/wardflow.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/env": { hasLiveSupabase: () => true },
    "@/lib/supabase/server": { createServerSupabaseClient: async options => {
      if (options?.clinicalData !== true) throw new Error("Clinical encryption must be enabled");
      return client;
    } },
    "@/lib/google-docs": {},
  });
  return { codec, tables, calls, client, rawClient, api, session };
}
