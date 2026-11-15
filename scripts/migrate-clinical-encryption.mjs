import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { isDeepStrictEqual } from "node:util";
import {
  clinicalConfigFromEnv, createClinicalCodec, isProtectedStoredValue, protectedColumns,
} from "../src/lib/server/clinical-crypto.mjs";

/** Backfill existing text/JSON columns without changing HNs or database relations. */
export async function migrateClinicalEncryption(client, codec, { apply = false, verifyOnly = false, pageSize = 100 } = {}) {
  const totals = {};
  for (const table of Object.keys(protectedColumns)) {
    let offset = 0;
    const counts = { scanned: 0, legacy: 0, updated: 0, verified: 0 };
    while (true) {
      const result = await client.from(table).select("*").order("id", { ascending: true }).range(offset, offset + pageSize - 1);
      if (result.error) throw new Error(`Cannot read ${table}; migration stopped (no row values logged).`);
      const rows = result.data ?? [];
      for (const raw of rows) {
        counts.scanned++;
        const columns = protectedColumns[table].filter(column => Object.hasOwn(raw, column));
        const plain = codec.decryptRow(table, raw);
        const legacy = columns.some(column => !isProtectedStoredValue(table, raw, column));
        if (legacy) counts.legacy++;
        if (legacy && verifyOnly) throw new Error(`Plaintext remains in ${table}; verification stopped.`);
        if (legacy) {
          const encrypted = codec.encryptRow(table, plain);
          const payload = Object.fromEntries(columns.map(column => [column, encrypted[column]]));
          const restored = codec.decryptRow(table, { ...raw, ...payload });
          if (!columns.every(column => isDeepStrictEqual(plain[column], restored[column]))) {
            throw new Error(`Round-trip mismatch in ${table}; source was not replaced.`);
          }
          if (apply) {
            let update = client.from(table).update(payload).eq("id", raw.id);
            if (typeof raw.updated_at === "string") update = update.eq("updated_at", raw.updated_at);
            const written = await update.select("*").maybeSingle();
            if (written.error || !written.data) throw new Error(`Write/conflict in ${table}; migration stopped.`);
            const checked = codec.decryptRow(table, written.data);
            if (!columns.every(column => isDeepStrictEqual(plain[column], checked[column]))) {
              throw new Error(`Post-write mismatch in ${table}; keep maintenance mode enabled.`);
            }
            counts.updated++;
          }
        }
        counts.verified++;
      }
      offset += rows.length;
      if (rows.length < pageSize) break;
    }
    totals[table] = counts;
  }
  return totals;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if ([...args].some(arg => !["--dry-run", "--apply", "--verify-only", "--maintenance-confirmed"].includes(arg)) ||
      (args.has("--apply") && (args.has("--dry-run") || args.has("--verify-only")))) {
    throw new Error("Use --dry-run (default), --verify-only, or --apply --maintenance-confirmed.");
  }
  const apply = args.has("--apply");
  if (apply && !args.has("--maintenance-confirmed")) throw new Error("Stop all application writers before applying the backfill.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Migration connection configuration is missing.");
  const config = clinicalConfigFromEnv();
  const codec = createClinicalCodec({ ...config, allowLegacyReads: !args.has("--verify-only") });
  // Raw client intentionally bypasses the application encryption transport.
  const WebSocket = globalThis.WebSocket ?? createRequire(import.meta.url)("next/dist/compiled/ws");
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket },
  });
  const totals = await migrateClinicalEncryption(client, codec, { apply, verifyOnly: args.has("--verify-only") });
  // Counts only: no HNs, names, row IDs, ciphertext or secrets in console output.
  process.stdout.write(JSON.stringify({ mode: apply ? "apply" : args.has("--verify-only") ? "verify-only" : "dry-run", totals }, null, 2) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  });
}
