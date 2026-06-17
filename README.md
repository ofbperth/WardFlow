# WardFlow

WardFlow is a mobile-first ward work management app for ward round, patient tasking, handover, discharge summaries, and audit tracking. It is intentionally not an EMR.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Supabase Auth + Postgres + Realtime
- Demo mode when Supabase env is missing in local development

## Current product scope

- Google login via Supabase Auth
- Role-based access for `admin`, `resident`, and `student`
- Ward census and patient detail flows
- Problem list, task board, handover, and discharged directory
- Discharge summary draft + Word export
- Admin controls for wards and user roles

## Local setup

1. Install dependencies

```bash
npm install
```

2. Copy env template

```bash
copy .env.example .env.local
```

3. Fill env values

```env
# Optional fallback when request headers are unavailable.
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
WARDFLOW_GITHUB_REPO_URL=https://github.com/ofbperth/WardFlow.git
```

4. Start the app

```bash
npm run dev
```

If Supabase env is missing in local development, WardFlow falls back to demo mode so the UI can still be reviewed end-to-end.

## Database

- Migrations: `supabase/migrations/*.sql`
- Realtime tables: `patients`, `problems`, `ward_tasks`, `handover_notes`
- Seeded task templates are included in the migration

## Prepare for deploy

1. Create a Supabase production project.
2. Enable Google provider in Supabase Auth.
3. Add Supabase Auth redirect URLs:
   - `https://<your-domain>/auth/callback`
   - for Vercel preview, also allow your preview pattern or each preview URL you will test
   - the app now derives OAuth origin from the incoming request, so preview login will return to the preview domain as long as that domain is allowlisted in Supabase
4. Apply every migration before login testing:
   - preferred: `supabase db push`
   - manual fallback: run each file in `supabase/migrations` in timestamp order
   - confirm the `profiles` and `discharge_summaries` tables exist because live sign-in and discharge flow depend on them
5. Set production environment variables:
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` is now only a fallback when request headers are unavailable; keep it as the production origin, for example `https://wardflow.example.com`
6. Run the release gate locally:

```bash
npm run verify
```

7. After deploy, verify:
   - `/login` opens correctly
   - Google login returns to `/auth/callback`
   - `/api/health` returns HTTP `200` with `ok: true`
   - a real ward page loads after sign-in
   - realtime updates still refresh patient/task/problem views

`/api/health` is a readiness check for production-shaped setup. It returns a failure status when Supabase env is incomplete or when the `profiles` table is not ready.

## Verification

Standard checks:

```bash
npm run lint
npm run typecheck
npm run build
```

Full release gate:

```bash
npm run verify
```
