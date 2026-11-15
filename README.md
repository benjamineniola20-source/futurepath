# FuturePath

FuturePath is a mobile-first UTME and Post-UTME preparation platform for Nigerian students.

## Current build

FuturePath is being built as an offline-first application with one shared React codebase for the web and Android app. The Android experience is designed around downloaded learning content, local exam sessions and later synchronisation.

### Offline-first foundation

- Installable web app manifest and service worker for the app shell.
- IndexedDB storage for downloaded subjects, topics, notes, questions and attempts.
- Student practice questions are selected from the local library and marked on the device without a live server request.
- Timed CBT sessions and answers are saved locally and restored if the app is closed or interrupted.
- Completed attempts are queued and synchronised when the device reconnects.
- A unique client attempt ID prevents duplicate server records when a sync is retried.
- Previously signed-in users can reopen the app offline on the same device after downloading content.

**Important:** the student must sign in and download content while connected before first offline use. Only downloaded question packs and notes are available without internet. The current starter library is small; it is not yet a complete JAMB archive. Offline marking requires answer keys on the device, so this is designed for learning and practice, not tamper-proof high-stakes examinations.

## Current prototype

- Supabase email/password authentication and student profiles.
- Student dashboard with recorded quiz scores and activity.
- All 25 approved UTME subject entries, including Use of English, Agricultural Science, Arabic, Art (Fine Art), Biology, Chemistry, CRS, Commerce, Economics, French, Geography, Government, Hausa, History, Home Economics, Igbo, Islamic Studies, Literature in English, Mathematics, Music, Physics, Principles of Accounts, Yoruba, Computer Studies and Physical and Health Education.
- A topic catalogue across all subjects (275 syllabus-aligned topic headings added in the curriculum seed, plus the original starter topics retained).
- Topic-by-topic study catalogue stored in Supabase and included in offline downloads.
- Randomised quiz and mock-question flows.
- Offline answer marking and local attempt recording, with server synchronisation when online.
- Past-question archive filters by subject and year.
- Admin-only content publishing for questions and study notes.
- Row Level Security on the learning and student data tables.

The current database currently has five published starter notes and five original demonstration questions. The new 25-subject curriculum contains 288 topic records in total, including the original starter topics. Full explanatory lesson notes and verified past-question papers still need to be added topic by topic. These are **not** official JAMB past questions. The archive will be expanded using verified, licensed or user-provided source material, with the correct year and source label. Do not copy entire third-party question banks into FuturePath without permission from the rights holder.

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

## Android app build

The repository includes a Capacitor 8 Android configuration and a GitHub Actions workflow for a test APK. Open **Actions → Build FuturePath Android APK → Run workflow** to build it. The generated debug APK is a testing build, not a Play Store release; release signing and store preparation are still required.

Capacitor 8 uses the shared `dist` build output, with relative asset paths for Android and the `/futurepath/` base path for GitHub Pages. See the [official Capacitor Android guide](https://capacitorjs.com/docs/android).

## GitHub Pages prototype

A GitHub Actions workflow builds and deploys the site from the `main` branch.

1. Open this repository's **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open the **Actions** tab and check the “Deploy FuturePath prototype” workflow.

The installable web app is available from the same site. Android packaging with Capacitor is the next delivery stage; an Android APK/AAB has not yet been built.\n\nThe intended site address is:

`https://benjamineniola20-source.github.io/futurepath/`

After deployment, add that address to Supabase Authentication → URL Configuration as the Site URL and an allowed redirect URL.

## Content and copyright

Do not label original practice questions as official JAMB questions. Add past-question content only when it is provided by the project owner or obtained from a source that permits its use. Keep source, year and subject metadata accurate.



## UTME question bank and curriculum

The published database contains original FuturePath UTME practice questions across all 25 subjects. These questions are newly authored revision material, not historical JAMB past questions. The question archive must label them accurately; a year filter is only for verified year-specific material. The additional 75-question pack is in [supabase/seed_utme_practice_pack_02.sql](supabase/seed_utme_practice_pack_02.sql), alongside the original [50-question pack](supabase/seed_all_subject_practice_questions.sql).

The 25-subject catalogue and 288 topic headings are intended as a UTME study map. Continue validating topic coverage against the current JAMB IBASS syllabus and expanding complete topic-by-topic lessons. Do not describe this project as an O'Level preparation platform.
