# CLAUDE.md — apps/mobile

Loaded when working under `apps/mobile/`. Repo-wide rules (commits, testing) are in the root `CLAUDE.md`.

## Environment

Mobile: `apps/mobile/.env` holds the same Firebase config as `EXPO_PUBLIC_FIREBASE_*`, plus
`EXPO_PUBLIC_API_BASE_URL` (the web app's origin, for the API routes). Both apps read the
Firebase config through `packages/shared/src/lib/firebaseConfig.ts`.
