# WardFlow

WardFlow is a mobile-first ward work management module for doctors, nurses, and admins. It sits between ward round, ward work, and handover without trying to become a full EMR.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Supabase Auth + Postgres + Realtime
- Local demo mode when Supabase envs are not configured

## Features

- Google Login with Supabase Auth
- Role-based access (`doctor`, `senior_doctor`, `nurse`, `admin`)
- Ward census cards
- Patient summary, structured problem list, and task board
- Auto-generated handover mode
- Full activity timeline
- Supabase migration for core schema, RLS, and Realtime publication

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template:

```bash
copy .env.example .env.local
```

3. Fill live Supabase envs for production-shaped auth and database mode:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

4. Start the dev server:

```bash
npm run dev
```

If the Supabase envs are missing and you are running locally, the login page exposes a demo mode so the UI can still be reviewed end-to-end.

## Database

- Migration: `supabase/migrations/20260616130500_create_wardflow.sql`
- Realtime tables: `patients`, `problems`, `ward_tasks`, `handover_notes`
- Seeded task templates are included in the migration

## Verification

Run the standard checks:

```bash
npm run lint
npm run typecheck
npm run build
```
