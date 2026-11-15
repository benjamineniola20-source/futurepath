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