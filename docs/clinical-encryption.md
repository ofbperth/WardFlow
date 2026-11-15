# Clinical encryption and HN display

## Behavior

- Census, patient header and patient details display `1234567` as `34567-12` and `HN6600012` as `6600012-HN`.
- This is display formatting only. The original HN is retained in the model, admit/edit forms, Copy HN, Summary Note preview/copy and export. One/two-character HNs remain unchanged because there is no remaining segment to rotate.
- Rotation is not encryption. Authorized browser users still receive the original HN for editing/copying.
- Live database traffic uses AES-256-GCM on selected clinical columns before sending them to Supabase. Decryption occurs on the application server after the existing session and RLS flow. This is server-side encryption, not E2EE.
- Protected columns are listed in `src/lib/server/clinical-crypto.mjs`: HN/AN/name, patient clinical text, problem titles and notes (including legacy fields), ward-work titles/notes, handover, discharge-summary text and audit before/after payloads.
- IDs, foreign keys, wards/beds, age/sex, staff metadata, status, timestamps and other structural fields remain database-readable. Data is not anonymous. The protection target is a database-only leak without access to the application keys.

## Key configuration

Provide these **server-only secrets** through the hosting secret configuration; never use `NEXT_PUBLIC_`, a database table, Git, application logs or browser storage:

- `WARDFLOW_ENCRYPTION_KEY_ID`: the active key ID (letters, digits, `_`, `-`, `.`; at most 64 characters).
- `WARDFLOW_ENCRYPTION_KEYS`: a JSON object mapping key IDs to base64-encoded **32-byte cryptographically random keys**. There is intentionally no usable example key or auto-generated fallback in the repository.
- `WARDFLOW_ENCRYPTION_ALLOW_LEGACY_READS`: `false` normally. `true` permits plaintext reads only during the controlled migration; **writes are always encrypted**.

Use separate keys for each environment/database. Keep securely controlled, recoverable copies of the keys separately from database backups. Losing the key makes encrypted data inaccessible. Do not discard old keys while data/backups still require them. For rotation, retain previous key IDs alongside the new active ID and plan an explicit verified re-encryption of existing records; the initial backfill does not rotate already-encrypted values automatically.

No key values were generated or installed for production as part of the local implementation. Missing/invalid keys block live clinical access. `/api/health` returns 503 for missing keys or legacy-read mode. Demo fixtures do not require encryption keys and must contain synthetic data only.

## Controlled rollout — do not deploy independently of the data transition

This change requires a maintenance window. Deploying the new code without keys/backfill will block clinical pages; applying constraints while old writers remain active will reject their plaintext writes.

1. Back up the database and establish secure key backup/recovery. Verify restoration in an isolated environment. Confirm authorization, hosting and privacy requirements separately.
2. Configure keys for the new release. Dry-run the backfill with synthetic/staging data and then the intended database. `--dry-run` is the default and writes nothing. Only aggregate counts are printed.
3. Stop **all** application writers, including old deployments/direct integrations, and maintain that stop until the transition is verified. Prevent concurrent updates/deletes while paginating the backfill.
4. Apply only the intended database migration `20261115173915_enforce_clinical_ciphertext.sql` using the project's normal migration procedure. It adds `NOT VALID` shape checks: existing rows can be backfilled, but new plaintext writes are blocked. Existing RLS is unchanged. These checks enforce storage format, not cryptographic authentication; the application verifies GCM tags.
5. Backfill with the new keys using `--apply --maintenance-confirmed`. The tool verifies round-trip equality before writing each row, checks the original `updated_at` where available and verifies the returned stored data again. It is **not a transaction across all tables**; on error remain in maintenance, preserve all keys, investigate and resume. Do not restart old writers against partially encrypted data.
6. Run `--verify-only` with strict decryption. It must scan all protected rows successfully with no plaintext. Validate the `wf_enc_*` constraints with the SQL below. Verify authenticated admit/edit, both autosaves, transfer, discharge, clipboard and exports in staging before restoring access.
7. Start the new release with `WARDFLOW_ENCRYPTION_ALLOW_LEGACY_READS=false`, confirm health and repeat authorized smoke checks. Only then restore access. A rollback must use an encryption-aware release; an old release will misread ciphertext.

Run with explicitly selected, protected environment configuration (the filename below is a placeholder; never commit it):

```powershell
node --env-file=<protected-env-file> scripts/migrate-clinical-encryption.mjs --dry-run
node --env-file=<protected-env-file> scripts/migrate-clinical-encryption.mjs --apply --maintenance-confirmed
node --env-file=<protected-env-file> scripts/migrate-clinical-encryption.mjs --verify-only
```

The backfill needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the encryption key variables. It uses a raw administrative client intentionally; the application always uses the user's authenticated client/RLS. Do not run these commands against production as part of normal tests.

After successful backfill, execute within a maintenance transaction as an authorized database operator:

```sql
do $$
declare item record;
begin
  for item in
    select n.nspname, c.relname, p.conname
    from pg_constraint p
    join pg_class c on c.oid = p.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and p.conname like 'wf_enc_%'
  loop
    execute format('alter table %I.%I validate constraint %I', item.nspname, item.relname, item.conname);
  end loop;
end $$;
```

The migration accepts SQL `transfer_patient` audit snapshots only when patient identity matches and all present protected fields are encrypted/null. The server decrypts those nested snapshots for existing Timeline consumers. Other audit JSON is encrypted as a whole.

## Autosave and confidentiality boundaries

- Each encryption uses a new random 96-bit IV and a 128-bit authentication tag. Authentication binds the key ID, table, stable record identity and column. Progress notes bind to `problem_id` because current-entry IDs change per save. No unauthenticated partial plaintext is returned.
- U/D preserves its atomic field comparison: a per-client snapshot replaces the plaintext equality filter with the exact stored ciphertext. Plaintext U/D is not sent as a PostgREST filter. Unsupported searches/orders over encrypted columns fail instead of silently comparing ciphertext.
- A Progress-note retry re-encrypts its payload with a new IV. If the SQL RPC reports `Invalid retry`, the server reads that exact request ID and verifies problem, author and decrypted text before acknowledging the committed save. New edits keep the existing revision checks. Old same-record ciphertext remains cryptographically valid: encryption does not replace concurrency/replay controls.
- Application-server operators with key access can read data. Authorized users can copy it. Clipboard, downloaded documents and Google Docs exports contain plaintext by design. Google Docs export is an explicit disclosure outside encrypted storage. This feature does not purge existing exports or backups.
- Browser drafts still use the existing sessionStorage behavior for unsaved notes; they are not encrypted by this server-side database layer. Device security and confidentiality obligations remain.

## Repeatable verification

```powershell
npm run test:clinical-encryption
node --test tests/patient-underlying.test.mjs tests/summary-note.test.mjs
npm run typecheck
```

Postgres tests use an optional PGlite **test-only runtime installed outside project dependencies**. Set `PGLITE_MODULE` to its module path, then run `npm run test:clinical-encryption:postgres`. They execute the actual new migration and existing transfer/autosave SQL on synthetic tables. Auth/ward helper functions are isolated test stubs; this does not prove live RLS configuration.

Set `PLAYWRIGHT_MODULE` to an installed Playwright module and run `npm run test:hn-browser`. This starts its own local demo server with blank Supabase/Google credentials and an isolated temporary synthetic data store, checks desktop/mobile forms and actual clipboard text, and stops its own process tree. `TEST_ARTIFACT_DIR` optionally selects a screenshot directory. It never uses the user's existing demo store.

Local test results do not verify production key configuration, live RLS, historical backup deletion, physical Android clipboard behavior or legal compliance.
