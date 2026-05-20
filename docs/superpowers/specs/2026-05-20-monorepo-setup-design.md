# Monorepo Setup Design — bs-kara + Mobile App

**Date:** 2026-05-20  
**Status:** Approved  
**Scope:** Restructure bs-kara into a Turborepo monorepo to support a new Expo (React Native) mobile app alongside the existing Next.js web app, with maximum shared code between platforms.

---

## 1. Goals

- Add a native mobile app (Expo) that covers both the phone remote and TV player flows
- Share Firebase logic, hooks, types, i18n, and business utilities between web and mobile
- Preserve the existing web app's deployment pipeline, tests, and developer workflow
- Adopt a flat, prefixed package naming convention that scales as the project grows

---

## 2. Repository structure

Flat layout at the repo root, all packages prefixed `bk-`:

```
bs-kara/                       ← git root (same repo, same remote)
├── bk-web/                    ← Next.js 15 web app (current source moved here)
├── bk-mobile/                 ← Expo app (new)
├── bk-mobile-ui/              ← React Native UI components (new)
├── bk-shared/                 ← shared Firebase, hooks, types, i18n, utils
├── e2e/                       ← Playwright E2E tests (moved from bk-web root)
├── scripts/                   ← shared tooling scripts
├── pnpm-workspace.yaml
├── turbo.json
├── package.json               ← workspace root scripts
└── CLAUDE.md
```

**Package manager:** pnpm (hard-linked node_modules, standard for Turborepo).

---

## 3. Package responsibilities

### `bk-shared` (`@bs-kara/shared`)

Everything that contains no browser or native APIs — usable in both web and mobile.

**Migrated from current codebase:**

| Current path | Notes |
|---|---|
| `lib/firebase.ts` | Firebase JS SDK v9+ modular, works on RN |
| `lib/activeRoom.ts` | Pure Firebase `runTransaction` logic |
| `lib/roomPaths.ts` | String constants |
| `lib/resetRoom.ts` | Firebase writes |
| `lib/config.ts` | Env config shape |
| `lib/reactions.ts` | Pure data |
| `lib/random/` | Random picker + song pools |
| `lib/text/normalize.ts` | String utility |
| `hooks/useRoom/` | Firebase RTDB subscriptions, no DOM |
| `hooks/useAutoRandom.ts` | Firebase writes + random picker |
| `hooks/useMCPlayer.ts` | Firebase + TTS URL logic |
| `hooks/useMCKickPlay.ts` | Pure state transition hook |
| `hooks/useTransientNotice.ts` | Pure timer hook |
| `hooks/useAIVoice.ts` | Firebase reads only |
| `lib/youtube/types.ts` | TypeScript types |
| `hooks/useRoom/types.ts` | TypeScript types |
| `locales/en.json`, `vi.json` | react-i18next works on RN |

**Stays in `bk-web` only:**

| Current path | Reason |
|---|---|
| `app/api/*` | Next.js server routes |
| `components/` | HTML + Tailwind CSS |
| `features/*/components/` | Web UI components |
| `hooks/useScrollOffset.ts` | `window.scrollY` — browser only |
| `hooks/useAutoHide.ts` | CSS class manipulation — browser only |
| `lib/publicOrigin.ts` | `window.location` — browser only |
| `lib/registeredUsers.ts` | Firebase Admin SDK — server only |

### `bk-web` (`@bs-kara/web`)

Current bs-kara source moved into this directory. All Next.js app structure, server routes, web UI components, and web-only hooks remain here. Imports from `@/lib/*` and `@/hooks/*` that were migrated to `bk-shared` are updated to `@bs-kara/shared`.

### `bk-mobile` (`@bs-kara/mobile`)

New Expo app covering both remote and TV flows.

**Screen structure (Expo Router):**
```
bk-mobile/app/
├── (remote)/
│   ├── index.tsx        ← search + queue (phone remote)
│   └── settings.tsx     ← settings sheet
├── (tv)/
│   └── index.tsx        ← TV player screen
└── _layout.tsx          ← root layout: i18n + Firebase init
```

**Key dependencies:**
- `expo-router` — file-based navigation (mirrors Next.js App Router)
- `nativewind` v4 — Tailwind CSS syntax for React Native
- `react-native-youtube-iframe` — YouTube playback via WebView
- `react-i18next` — same library as web; locales from `@bs-kara/shared`
- Firebase JS SDK — same modular SDK, no RN-specific version needed
- `@bs-kara/shared` — all Firebase hooks and business logic
- `@bs-kara/mobile-ui` — native UI components

**Critical Metro config for monorepo resolution:**
```js
// bk-mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
```

Without this, Metro cannot resolve symlinked workspace packages at runtime.

### `bk-mobile-ui` (`@bs-kara/mobile-ui`)

Native UI components: queue items, search result cards, emoji reactions, settings rows — built with React Native primitives + NativeWind. Decoupled from app navigation so components can be tested and iterated independently.

---

## 4. Build pipeline (Turborepo)

**`turbo.json`:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": { "dependsOn": ["^build"] },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

`"dependsOn": ["^build"]` ensures `bk-shared` builds before any consumer app.

**Root `package.json` scripts:**
```json
{
  "scripts": {
    "dev":        "turbo dev --filter=@bs-kara/web",
    "dev:mobile": "turbo dev --filter=@bs-kara/mobile",
    "dev:all":    "turbo dev",
    "build":      "turbo build",
    "lint":       "turbo lint",
    "test":       "turbo test",
    "typecheck":  "turbo typecheck"
  }
}
```

`npm run dev` starts only the web app — identical to today's workflow.

**`pnpm-workspace.yaml`:**
```yaml
packages:
  - 'bk-web'
  - 'bk-mobile'
  - 'bk-mobile-ui'
  - 'bk-shared'
```

---

## 5. Deployment

**Web (Vercel):** Set Root Directory to `bk-web` in Vercel dashboard. Vercel detects Turborepo automatically and only rebuilds when `bk-web` or `bk-shared` changes. No pipeline changes required.

**Mobile:** Expo Application Services (EAS) build from `bk-mobile/`. EAS supports monorepos natively via `eas.json` with `appVersionSource` and `buildProfile` targeting the `bk-mobile` directory.

---

## 6. Testing strategy

| Location | Framework | What it covers |
|---|---|---|
| `bk-web/` | Vitest + Playwright | All existing web unit, component, hook, E2E tests — unchanged |
| `bk-shared/` | Vitest | All migrated tests (activeRoom, useRoom, useAutoRandom, etc.) |
| `bk-mobile/` | RNTL + Vitest | Screen logic, hook integration |
| `bk-mobile-ui/` | RNTL | Native component tests |
| `e2e/` (root) | Playwright | Web E2E (same as current, moved to root) |
| `bk-mobile/` | Maestro | Mobile E2E on simulator (simpler than Detox for small team) |

Running all tests from root: `turbo test` (parallel, cached).

The existing CLAUDE.md testing policy (bug regression tests, Rule 1–6) applies to `bk-web` and `bk-shared` unchanged. Mobile testing policy to be defined when Expo scaffold is implemented.

---

## 7. Migration sequence (high level)

1. Add `pnpm-workspace.yaml`, `turbo.json`, root `package.json` at repo root
2. Create `bk-shared/` — copy and refactor shared files, update their internal imports, migrate their tests
3. Move current Next.js source into `bk-web/` — update imports from `@/lib/*` / `@/hooks/*` to `@bs-kara/shared`
4. Leave `e2e/` and `playwright.config.ts` at repo root (already there — do not move into `bk-web/`); update `playwright.config.ts` `webServer.command` to run from `bk-web/`
5. Verify: `turbo build`, `turbo test`, `turbo typecheck` all green; Vercel deploy unaffected
6. Scaffold `bk-mobile/` with Expo + Metro config + workspace dependencies
7. Scaffold `bk-mobile-ui/` with NativeWind primitives
8. Implement mobile screens using hooks from `@bs-kara/shared`

Each step is its own branch and PR (per the project's branch-per-step workflow).

---

## 8. What does NOT change

- Git repository, remote, and history
- Vercel deployment (just Root Directory setting)
- Next.js config, Tailwind, ESLint, Vitest, Playwright inside `bk-web/`
- All existing tests (migrate with their source files)
- Firebase Realtime Database schema and rules
- CLAUDE.md testing policy
