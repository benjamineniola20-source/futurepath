# FuturePath

FuturePath is a mobile-first UTME and Post-UTME preparation platform for Nigerian students.

## Current prototype

- Supabase email/password authentication and student profiles.
- Student dashboard with recorded quiz scores and activity.
- Five subjects: English, Mathematics, Biology, Chemistry and Physics.
- Topic-based study notes stored in Supabase.
- Randomised quiz and mock-question flows.
- Secure server-side answer marking and attempt recording.
- Past-question archive filters by subject and year.
- Admin-only content publishing for questions and study notes.
- Row Level Security on the learning and student data tables.

The current database starts with five original demonstration questions and five starter notes. These are **not** official JAMB past questions. The archive will be expanded using verified, licensed or user-provided source material, with the correct year and source label.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
```

## Supabase

The connected Supabase project is configured in `src/lib/supabase.ts` with its public publishable key. A publishable key is intended for frontend use; all access must still be controlled by database Row Level Security. Never add a service-role key or database password to frontend code or Git.

The database contains:
- `profiles`, `subjects`, `topics`, `study_notes`, `questions`
- `exams`, `exam_questions`, `attempts`, `attempt_answers`
- Secure RPC functions for random question delivery and attempt submission.

New accounts receive the student role automatically. To make the first administrator:
1. Create your own account through FuturePath.
2. In Supabase SQL Editor, run the following after replacing the email with the exact email used for that account:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('YOUR-ACCOUNT-EMAIL');
```

Only do this for the trusted owner account. Never allow public signup to choose its own role.

## GitHub Pages prototype

A GitHub Actions workflow builds and deploys the site from the `main` branch.

1. Open this repository's **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open the **Actions** tab and check the “Deploy FuturePath prototype” workflow.

The intended site address is:

`https://benjamineniola20-source.github.io/futurepath/`

After deployment, add that address to Supabase Authentication → URL Configuration as the Site URL and an allowed redirect URL.

## Content and copyright

Do not label original practice questions as official JAMB questions. Add past-question content only when it is provided by the project owner or obtained from a source that permits its use. Keep source, year and subject metadata accurate.
