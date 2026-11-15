# Local verification — clinical encryption and HN display

Date: 16 November 2026 (Asia/Bangkok). Verification used no production writes or deployments. Git publication is handled separately from activation.

## Confirmed

| Check | Observed result |
|---|---|
| Automated regression run | 52 tests passed, zero failed/skipped, including the 5 Postgres checks |
| Resident/ward tests | 5 passed |
| HN preservation | 10,000 synthetic HNs round-tripped through the actual application codec without mismatch |
| Supabase SDK integration | Actual admit/save/read/Summary Note code ran against an isolated REST fixture; stored HN/name/audit payloads were encrypted, restored values matched originals |
| U/D and Progress note | Atomic field check, stale writes and committed retries retained their expected behavior with ciphertext |
| PostgreSQL | PGlite 0.3.14 executed the actual new constraints and existing transfer/autosave SQL; plaintext writes rejected; encrypted records and transfer audit snapshots preserved HNs; all added constraints validated |
| Browser | Headless Chrome at desktop and Pixel 7 emulation passed admit/edit, leading zeros, letter prefixes, original Copy HN and original Summary Note clipboard content; no page errors |
| TypeScript/build | `npm run build -- --webpack` passed compilation, TypeScript and route generation |
| Project-code lint | `npx eslint src tests scripts experiments` passed |
| Client bundle boundary | No encryption key environment name, crypto error class or ciphertext envelope marker found in `.next/static` JavaScript |

The Postgres checks are opt-in via `npm run test:clinical-encryption:postgres` and `PGLITE_MODULE`; they are intentionally not included in the default `*.test.mjs` glob when the optional runtime is absent.

## Limits and remaining rollout work

- Full `npm run lint` reports three existing require-import errors in the pre-existing untracked `.codex/check-summary-compact.cjs`; that user file was not changed.
- Turbopack's local CSS worker failed before the test route could compile, both with and without sandbox restrictions. Switching the test command to webpack let the same browser flow pass. The underlying Turbopack worker-launch issue was not resolved or attributed to application code.
- PostgreSQL tests use synthetic tables and isolated auth/ward helper stubs. They do not verify the actual production schema/RLS or hosting configuration.
- Browser checks use local demo mode with blank service credentials and an isolated temporary store. No physical Android test or real Google Docs export was performed. Integration tests exercise actual application data functions with the real Supabase SDK and a synthetic HTTP fixture; the live cloud service was not used.
- Before production use, create and securely back up server-only encryption keys, coordinate the maintenance window, apply the intended constraints, backfill and verify all historical protected data, validate constraints and deploy with strict reads. Follow `docs/clinical-encryption.md`. Deploying code alone without this transition will block live clinical access.
- Database backups, existing exports, clipboard data and local unsaved browser drafts are outside this database encryption layer. This is not an anonymity or legal-compliance certification.
