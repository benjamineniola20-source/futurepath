# FuturePath

FuturePath is a mobile-friendly UTME and Post-UTME preparation platform.

## Current foundation

- React + TypeScript + Vite frontend
- Responsive student dashboard
- Subject selection for English, Mathematics, Biology, Chemistry and Physics
- Starter CBT practice flow with answer checking and explanations
- Starter study-note library with topic search

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Important

The current question and study-note content is starter demonstration material, not a verified collection of official JAMB past questions. Authentication, persistent progress, admin question management, timed full exams and payment verification are not connected yet. Those will be added as separate, tested milestones.

Never put database service-role keys or payment secret keys in frontend code.

## Connect Supabase authentication

1. Create a Supabase project.
2. In Project Settings > API, copy the Project URL and the publishable key (or legacy anon key).
3. Copy `.env.example` to `.env.local` and fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. In Supabase Dashboard > SQL Editor, run `supabase/schema.sql`.
5. In Authentication > URL Configuration, set the Site URL to your deployed app URL. Add your local development URL (for example `http://localhost:5173`) to the allowed redirect URLs while testing.
6. Install dependencies and restart the dev server after changing environment variables.

The frontend uses Supabase Auth for email/password sign-up and sign-in. If email confirmation is enabled in Supabase, students must confirm their email before they can sign in. The SQL creates a protected profile row for each new account. New accounts are always students; assign admin access manually from the SQL editor to a trusted account.

Only use the publishable/anon key in frontend environment variables. Never put a Supabase service-role or secret key in a browser app.
