# Monorepo Migration — Plan 1: Infrastructure + bk-shared + bk-web

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the repo root into a pnpm + Turborepo monorepo, extract all platform-agnostic code into `bk-shared`, and move the existing Next.js app into `bk-web/` — leaving the web app fully functional and all tests green.

**Architecture:** Flat workspace layout (`bk-web/`, `bk-mobile/`, `bk-shared/`) at repo root. `bk-shared` is a source-only internal package (no build step — consumers transpile its TypeScript directly). Imports in `bk-web` that referenced moved files are updated to `@bs-kara/shared`.

**Tech Stack:** pnpm workspaces, Turborepo 2, TypeScript, Next.js 15, Vitest, Playwright.

> **⚠️ Scope note — three hooks stay in `bk-web`:**
> `useAutoRandom` (calls `/api/youtube/search`), `useMCPlayer` (calls `/api/generate-mc`), and `useAIVoice` (calls `/api/tts` + uses `window.speechSynthesis`) reference Next.js API routes and browser audio APIs. They are NOT moved to `bk-shared` in this plan. Plan 2 (mobile) will refactor them to accept injected functions.
>
> `hooks/useRoom/mc.ts` goes to `bk-shared` because its only non-Firebase call (`fetch('/api/generate-mc')`) is inside a try/catch and degrades gracefully on mobile. Plan 2 will inject a platform-specific generator function.

---

## File map

### Created at repo root
- `pnpm-workspace.yaml`
- `turbo.json`
- `package.json` (workspace root — replaces current root package.json scripts)
- `.npmrc`

### Created in `bk-shared/`
```
bk-shared/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── tests/
│   └── setup.ts                 ← simplified (no Next.js mocks, no MSW)
└── src/
    ├── index.ts                 ← barrel export of everything
    ├── locales/
    │   ├── en.json              ← copy of locales/en.json
    │   └── vi.json              ← copy of locales/vi.json
    ├── lib/
    │   ├── firebase.ts          ← copy; no import changes needed (already relative)
    │   ├── activeRoom.ts        ← copy; no import changes needed
    │   ├── roomPaths.ts         ← copy as-is
    │   ├── resetRoom.ts         ← copy as-is
    │   ├── config.ts            ← copy as-is
    │   ├── reactions.ts         ← copy as-is
    │   ├── ptDateKey.ts         ← copy as-is
    │   ├── i18n.ts              ← copy; remove 'use client'; update @/locales/ → relative
    │   ├── random/
    │   │   ├── picker.ts        ← copy; uses relative imports already
    │   │   └── songPools.ts     ← copy as-is
    │   ├── scoring/
    │   │   ├── index.ts         ← copy as-is
    │   │   ├── computeScore.ts  ← copy as-is
    │   │   ├── weights.ts       ← copy as-is
    │   │   └── verdictTable.ts  ← copy as-is
    │   ├── text/
    │   │   └── normalize.ts     ← copy as-is
    │   └── youtube/
    │       └── types.ts         ← copy; update @/lib/scoring → ../scoring
    └── hooks/
        ├── useRoom/
        │   ├── index.ts         ← copy; remove 'use client'
        │   ├── subscribe.ts     ← copy; remove 'use client'; @/lib/* → relative
        │   ├── queue.ts         ← copy; remove 'use client'; @/lib/* → relative
        │   ├── history.ts       ← copy; remove 'use client'; @/lib/* → relative
        │   ├── mc.ts            ← copy; remove 'use client'; @/lib/* → relative
        │   ├── settings.ts      ← copy; remove 'use client'; @/lib/* → relative
        │   └── types.ts         ← copy; @/lib/youtube/types → relative
        └── useTransientNotice.ts ← copy; remove 'use client'
```

### Moved into `bk-web/` (via `git mv`)
Everything currently at repo root except: `e2e/`, `playwright.config.ts`, `CLAUDE.md`, `README.md`, `docs/`, `database.rules.json`, `.claude/`, `.tmp/`.

Files that move: `app/`, `components/`, `features/`, `hooks/`, `lib/`, `locales/`, `tests/`, `public/`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `vitest.rules.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `vercel.json`, `firebase.json`.

### Deleted from `bk-web/` after move (these now live in bk-shared)
- `bk-web/lib/firebase.ts`
- `bk-web/lib/activeRoom.ts`
- `bk-web/lib/roomPaths.ts`
- `bk-web/lib/resetRoom.ts`
- `bk-web/lib/config.ts`
- `bk-web/lib/reactions.ts`
- `bk-web/lib/ptDateKey.ts`
- `bk-web/lib/i18n.ts`
- `bk-web/lib/random/`
- `bk-web/lib/scoring/`
- `bk-web/lib/text/`
- `bk-web/lib/youtube/types.ts`
- `bk-web/hooks/useRoom/`
- `bk-web/hooks/useTransientNotice.ts`
- `bk-web/locales/`

### Modified in `bk-web/`
- `bk-web/package.json` — new file replacing current root `package.json`
- `bk-web/next.config.ts` — add `transpilePackages: ['@bs-kara/shared']`
- `bk-web/tsconfig.json` — stays the same (paths: `@/*` → `./*`)
- `bk-web/vitest.config.ts` — add `@bs-kara/shared` resolver alias
- All `.ts`/`.tsx` files in `bk-web/` that import from deleted paths → updated to `@bs-kara/shared`

---

## Task 1: Bootstrap monorepo root

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `package.json` (workspace root)
- Create: `.npmrc`

- [ ] **Step 1.1: Install pnpm globally**

```bash
npm install -g pnpm@10
pnpm --version
```
Expected: prints `10.x.x`

- [ ] **Step 1.2: Create `.npmrc`**

```
# .npmrc
node-linker=hoisted
```

The `node-linker=hoisted` setting makes pnpm behave like npm for module resolution — required for Next.js and Expo which expect a flat `node_modules` layout.

- [ ] **Step 1.3: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'bk-web'
  - 'bk-mobile'
  - 'bk-mobile-ui'
  - 'bk-shared'
```

- [ ] **Step 1.4: Create `turbo.json`**

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
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 1.5: Create workspace root `package.json`**

```json
{
  "name": "bs-kara",
  "private": true,
  "scripts": {
    "dev": "turbo dev --filter=@bs-kara/web",
    "dev:mobile": "turbo dev --filter=@bs-kara/mobile",
    "dev:all": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "turbo": "^2"
  }
}
```

- [ ] **Step 1.6: Commit**

```bash
git add pnpm-workspace.yaml turbo.json package.json .npmrc
git commit -m "chore: add monorepo root config (pnpm workspaces + turbo)"
```

---

## Task 2: Scaffold `bk-shared` package

**Files:**
- Create: `bk-shared/package.json`
- Create: `bk-shared/tsconfig.json`
- Create: `bk-shared/vitest.config.ts`
- Create: `bk-shared/tests/setup.ts`

- [ ] **Step 2.1: Create `bk-shared/package.json`**

```json
{
  "name": "@bs-kara/shared",
  "version": "0.0.1",
  "private": true,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "peerDependencies": {
    "react": ">=18"
  },
  "dependencies": {
    "firebase": "^12.12.1",
    "i18next": "^26.0.8",
    "react-i18next": "^17.0.4"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "^19",
    "@vitejs/plugin-react": "^6.0.1",
    "jsdom": "^29.1.1",
    "react": "19.2.4",
    "typescript": "^5",
    "vitest": "^4.1.5"
  }
}
```

- [ ] **Step 2.2: Create `bk-shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2.3: Create `bk-shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: false,
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**'],
  },
});
```

- [ ] **Step 2.4: Create `bk-shared/tests/setup.ts`**

A simplified setup — no Next.js mocks, no MSW, just jest-dom matchers and React cleanup.

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (!opts) return key;
      let out = key;
      for (const [k, v] of Object.entries(opts)) {
        out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      }
      return out;
    },
    i18n: { changeLanguage: () => Promise.resolve(), language: 'vi' },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 2.5: Commit**

```bash
git add bk-shared/
git commit -m "chore: scaffold bk-shared package"
```

---

## Task 3: Populate `bk-shared/src/lib/`

**Files:**
- Create: all `bk-shared/src/lib/**` files

For files that are pure copies (no import changes): `lib/config.ts`, `lib/reactions.ts`, `lib/ptDateKey.ts`, `lib/random/songPools.ts`, `lib/random/picker.ts`, `lib/text/normalize.ts`, `lib/roomPaths.ts`, `lib/resetRoom.ts`, `lib/firebase.ts`, `lib/activeRoom.ts`, `lib/scoring/*`.

These use relative imports already and need no modification. Copy them verbatim.

- [ ] **Step 3.1: Copy unchanged lib files**

```bash
mkdir -p bk-shared/src/lib/random bk-shared/src/lib/text bk-shared/src/lib/youtube bk-shared/src/lib/scoring

cp lib/firebase.ts        bk-shared/src/lib/firebase.ts
cp lib/activeRoom.ts      bk-shared/src/lib/activeRoom.ts
cp lib/roomPaths.ts       bk-shared/src/lib/roomPaths.ts
cp lib/resetRoom.ts       bk-shared/src/lib/resetRoom.ts
cp lib/config.ts          bk-shared/src/lib/config.ts
cp lib/reactions.ts       bk-shared/src/lib/reactions.ts
cp lib/ptDateKey.ts       bk-shared/src/lib/ptDateKey.ts
cp lib/random/picker.ts   bk-shared/src/lib/random/picker.ts
cp lib/random/songPools.ts bk-shared/src/lib/random/songPools.ts
cp lib/text/normalize.ts  bk-shared/src/lib/text/normalize.ts
cp lib/scoring/index.ts   bk-shared/src/lib/scoring/index.ts
cp lib/scoring/computeScore.ts bk-shared/src/lib/scoring/computeScore.ts
cp lib/scoring/weights.ts bk-shared/src/lib/scoring/weights.ts
cp lib/scoring/verdictTable.ts bk-shared/src/lib/scoring/verdictTable.ts
```

- [ ] **Step 3.2: Create `bk-shared/src/lib/youtube/types.ts`**

Change the import of `ScoreRecord` from `@/lib/scoring` to a relative path:

```ts
import type { ScoreRecord } from '../scoring';

export interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string;
  requesterName?: string;
  mcText?: string;
  score?: ScoreRecord;
}

export interface QueueItem extends YouTubeVideo {
  queueId: string;
}

export type SingerType = 'all' | 'solo' | 'duet';
export type Tone = 'all' | 'male' | 'female';
export type Genre = 'all' | 'bolero' | 'caco' | 'tre';

export interface RandomFilters {
  type: SingerType;
  tone: Tone;
  genre: Genre;
}

export const DEFAULT_RANDOM_FILTERS: RandomFilters = {
  type: 'all',
  tone: 'all',
  genre: 'all',
};

export type SearchError = 'quota' | 'generic';

export interface SearchResult {
  videos: YouTubeVideo[];
  error?: SearchError;
}
```

- [ ] **Step 3.3: Create `bk-shared/src/lib/i18n.ts`**

Remove `'use client'` directive. Update `@/locales/` imports to relative paths.

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import vi from '../locales/vi.json';
import en from '../locales/en.json';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
    lng: 'vi',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

i18n.addResourceBundle('vi', 'translation', vi, true, true);
i18n.addResourceBundle('en', 'translation', en, true, true);

export default i18n;
```

- [ ] **Step 3.4: Copy locale JSON files**

```bash
mkdir -p bk-shared/src/locales
cp locales/en.json bk-shared/src/locales/en.json
cp locales/vi.json bk-shared/src/locales/vi.json
```

- [ ] **Step 3.5: Commit**

```bash
git add bk-shared/src/lib bk-shared/src/locales
git commit -m "feat(bk-shared): populate lib/ and locales/"
```

---

## Task 4: Populate `bk-shared/src/hooks/`

**Files:**
- Create: all `bk-shared/src/hooks/**` files

In every file: remove `'use client'` (first line if present). Replace `@/lib/firebase` → `'../lib/firebase'`, `@/lib/roomPaths` → `'../lib/roomPaths'`, `@/lib/youtube/types` → `'../lib/youtube/types'`.

- [ ] **Step 4.1: Create `bk-shared/src/hooks/useRoom/types.ts`**

Copy `hooks/useRoom/types.ts` verbatim, then update the one `@/` import:

```bash
mkdir -p bk-shared/src/hooks/useRoom
cp hooks/useRoom/types.ts bk-shared/src/hooks/useRoom/types.ts
sed -i '' "s|from '@/lib/youtube/types'|from '../../lib/youtube/types'|g" \
  bk-shared/src/hooks/useRoom/types.ts
```

Verify the change:
```bash
grep "youtube/types" bk-shared/src/hooks/useRoom/types.ts
```
Expected: `from '../../lib/youtube/types'` (no `@/` prefix remaining).

- [ ] **Step 4.2: Create `bk-shared/src/hooks/useRoom/subscribe.ts`**

Copy `hooks/useRoom/subscribe.ts`. Remove `'use client'` on line 1. Replace these imports:
- `import { db } from '@/lib/firebase'` → `import { db } from '../../lib/firebase'`
- `import { getRoomDataPath } from '@/lib/roomPaths'` → `import { getRoomDataPath } from '../../lib/roomPaths'`
- `} from '@/lib/youtube/types'` → `} from '../../lib/youtube/types'`

- [ ] **Step 4.3: Create `bk-shared/src/hooks/useRoom/queue.ts`**

Copy `hooks/useRoom/queue.ts`. Remove `'use client'`. Update imports:
- `'@/lib/firebase'` → `'../../lib/firebase'`
- `'@/lib/roomPaths'` → `'../../lib/roomPaths'`
- `'@/lib/youtube/types'` → `'../../lib/youtube/types'`

- [ ] **Step 4.4: Create `bk-shared/src/hooks/useRoom/history.ts`**

Copy `hooks/useRoom/history.ts`. Remove `'use client'`. Update:
- `'@/lib/firebase'` → `'../../lib/firebase'`
- `'@/lib/roomPaths'` → `'../../lib/roomPaths'`

- [ ] **Step 4.5: Create `bk-shared/src/hooks/useRoom/mc.ts`**

Copy `hooks/useRoom/mc.ts`. Remove `'use client'`. Update:
- `'@/lib/firebase'` → `'../../lib/firebase'`
- `'@/lib/roomPaths'` → `'../../lib/roomPaths'`

The `fetch('/api/generate-mc')` call stays as-is — it degrades gracefully (try/catch) on platforms where the URL doesn't resolve. Plan 2 will inject a platform-specific generator function.

- [ ] **Step 4.6: Create `bk-shared/src/hooks/useRoom/settings.ts`**

Copy `hooks/useRoom/settings.ts`. Remove `'use client'`. Update:
- `'@/lib/firebase'` → `'../../lib/firebase'`
- `'@/lib/roomPaths'` → `'../../lib/roomPaths'`
- `'@/lib/youtube/types'` → `'../../lib/youtube/types'`

- [ ] **Step 4.7: Create `bk-shared/src/hooks/useRoom/index.ts`**

Copy `hooks/useRoom/index.ts`. Remove `'use client'` on line 1. Internal imports (`'./subscribe'`, `'./mc'`, etc.) are already relative — no changes needed.

- [ ] **Step 4.8: Create `bk-shared/src/hooks/useTransientNotice.ts`**

Copy `hooks/useTransientNotice.ts`. Remove `'use client'` on line 1. No other changes needed.

- [ ] **Step 4.9: Commit**

```bash
git add bk-shared/src/hooks
git commit -m "feat(bk-shared): populate hooks/ (useRoom, useTransientNotice)"
```

---

## Task 5: Create `bk-shared` barrel export

**Files:**
- Create: `bk-shared/src/index.ts`

- [ ] **Step 5.1: Create `bk-shared/src/index.ts`**

```ts
// Firebase
export { db, auth } from './lib/firebase';

// Firebase room helpers
export { activateRoom, deactivateRoom, subscribeActiveRooms } from './lib/activeRoom';
export {
  getRoomDataPath,
  getRegisteredUsersPath,
  getRegisteredUserPath,
  getRoomCodeIndexPath,
  getRoomCodeIndexEntryPath,
  getActiveRoomsPath,
  getActiveRoomPresencePath,
} from './lib/roomPaths';
export { resetRoom } from './lib/resetRoom';

// Utilities
export { DEFAULT_HOT_HITS_QUERY } from './lib/config';
export { REACTIONS, getGifUrl, getStaticUrl } from './lib/reactions';
export { ptDateKey } from './lib/ptDateKey';
export { normalizeDiacritics } from './lib/text/normalize';

// Random / auto-random
export {
  buildRandomSearchQuery,
  pickBestVideo,
  pickRandomTitle,
} from './lib/random/picker';
export * from './lib/random/songPools';

// Types
export type {
  YouTubeVideo,
  QueueItem,
  RandomFilters,
  SingerType,
  Tone,
  Genre,
  SearchError,
  SearchResult,
} from './lib/youtube/types';
export { DEFAULT_RANDOM_FILTERS } from './lib/youtube/types';

// Scoring
export * from './lib/scoring';

// i18n
export { default as i18n } from './lib/i18n';

// Locales (for consumers that need the raw JSON)
export { default as localeEn } from './locales/en.json';
export { default as localeVi } from './locales/vi.json';

// Hooks
export { useRoom } from './hooks/useRoom';
export type { RoomState } from './hooks/useRoom/types';
export { useTransientNotice } from './hooks/useTransientNotice';
```

- [ ] **Step 5.2: Typecheck bk-shared standalone**

```bash
cd bk-shared
npx tsc --noEmit
```

Expected: zero errors. Fix any import path mistakes before continuing.

- [ ] **Step 5.3: Commit**

```bash
git add bk-shared/src/index.ts
git commit -m "feat(bk-shared): add barrel export"
```

---

## Task 6: Migrate tests to `bk-shared` and verify

**Files:**
- Copy test files for shared code into `bk-shared/src/`

Tests to migrate (they test shared code and have no Next.js dependencies):
- `lib/activeRoom.test.ts`
- `lib/reactions.test.ts`
- `lib/text/normalize.test.ts`
- `lib/random/picker.test.ts`
- `hooks/useRoom/queue.test.ts`
- `hooks/useRoom/subscribe.test.ts`
- `hooks/useTransientNotice.test.ts`
- `hooks/useRoom.test.ts`

Tests that stay in `bk-web` (test web-only code):
- `lib/logger.test.ts`
- `lib/youtube/client.test.ts`
- `hooks/useAutoRandom.test.ts`
- `hooks/useMCPlayer.test.ts`
- `hooks/useAIVoice.test.ts`

- [ ] **Step 6.1: Copy test files to bk-shared**

```bash
cp lib/activeRoom.test.ts         bk-shared/src/lib/activeRoom.test.ts
cp lib/reactions.test.ts          bk-shared/src/lib/reactions.test.ts
cp lib/text/normalize.test.ts     bk-shared/src/lib/text/normalize.test.ts
cp lib/random/picker.test.ts      bk-shared/src/lib/random/picker.test.ts
cp hooks/useRoom/queue.test.ts    bk-shared/src/hooks/useRoom/queue.test.ts
cp hooks/useRoom/subscribe.test.ts bk-shared/src/hooks/useRoom/subscribe.test.ts
cp hooks/useTransientNotice.test.ts bk-shared/src/hooks/useTransientNotice.test.ts
cp hooks/useRoom.test.ts          bk-shared/src/hooks/useRoom.test.ts
```

- [ ] **Step 6.2: Update test imports in bk-shared**

Each copied test file uses `@/` aliases. Replace with relative imports. Run this from the `bk-shared/` directory:

```bash
find src -name "*.test.ts" -o -name "*.test.tsx" | xargs sed -i '' \
  -e "s|from '@/lib/firebase'|from '../lib/firebase'|g" \
  -e "s|from '@/lib/roomPaths'|from '../lib/roomPaths'|g" \
  -e "s|from '@/lib/youtube/types'|from '../lib/youtube/types'|g" \
  -e "s|from '@/lib/reactions'|from '../lib/reactions'|g" \
  -e "s|from '@/lib/text/normalize'|from '../lib/text/normalize'|g" \
  -e "s|from '@/lib/random/picker'|from '../lib/random/picker'|g" \
  -e "s|from '@/hooks/useRoom'|from '../hooks/useRoom'|g" \
  -e "s|from '@/hooks/useTransientNotice'|from '../hooks/useTransientNotice'|g"
```

> **Note:** The sed paths use `../` because test files sit alongside their source files. Check the actual relative depth for each file and adjust if needed (e.g., a test in `src/hooks/useRoom/queue.test.ts` importing `src/lib/firebase` would need `'../../lib/firebase'`).

The correct relative prefix for each test location:
- `src/lib/*.test.ts` → `./` for same-dir, `../` for siblings
- `src/lib/random/*.test.ts` → `../` for `lib/`, `./` for same-dir
- `src/hooks/useRoom/*.test.ts` → `../../lib/` for lib files
- `src/hooks/*.test.ts` → `../lib/` for lib files

Run a targeted search to catch any remaining `@/` references:
```bash
grep -r "@/" bk-shared/src --include="*.ts" --include="*.tsx"
```
Expected: no output (zero remaining `@/` imports).

- [ ] **Step 6.3: Install bk-shared dependencies and run its tests**

```bash
cd bk-shared
pnpm install
pnpm test
```

Expected: all tests pass. If a test imports MSW (`tests/msw/...`) or Next.js mocks, that import must be removed — bk-shared tests don't use MSW.

- [ ] **Step 6.4: Commit**

```bash
git add bk-shared/src
git commit -m "test(bk-shared): migrate tests for shared lib + hooks"
```

---

## Task 7: Move web source into `bk-web/`

**Files:** All current web app source files move to `bk-web/` via `git mv`.

- [ ] **Step 7.1: Create `bk-web/` directory and move app source**

```bash
mkdir bk-web

git mv app bk-web/app
git mv components bk-web/components
git mv features bk-web/features
git mv hooks bk-web/hooks
git mv lib bk-web/lib
git mv locales bk-web/locales
git mv tests bk-web/tests
git mv public bk-web/public
```

- [ ] **Step 7.2: Move config files into `bk-web/`**

```bash
git mv next.config.ts bk-web/next.config.ts
git mv tsconfig.json bk-web/tsconfig.json
git mv vitest.config.ts bk-web/vitest.config.ts
git mv vitest.rules.config.ts bk-web/vitest.rules.config.ts
git mv eslint.config.mjs bk-web/eslint.config.mjs
git mv postcss.config.mjs bk-web/postcss.config.mjs
git mv vercel.json bk-web/vercel.json
git mv firebase.json bk-web/firebase.json
```

Do NOT move: `e2e/`, `playwright.config.ts`, `CLAUDE.md`, `README.md`, `docs/`, `database.rules.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`.

- [ ] **Step 7.3: Move the old `package.json` as the base for `bk-web/package.json`**

```bash
git mv package-lock.json /dev/null 2>/dev/null || rm -f package-lock.json
cp package.json bk-web/package.json
```

> The root `package.json` was already replaced in Task 1. The old one (with all Next.js deps) becomes the base for `bk-web/package.json` in the next task.

- [ ] **Step 7.4: Commit the move**

```bash
git add -A
git commit -m "chore: move Next.js source into bk-web/"
```

---

## Task 8: Configure `bk-web` as a workspace package

**Files:**
- Modify: `bk-web/package.json`
- Modify: `bk-web/next.config.ts`
- Modify: `bk-web/vitest.config.ts`
- Modify: `bk-web/tsconfig.json` (verify paths still resolve)

- [ ] **Step 8.1: Update `bk-web/package.json`**

Add the `name` field and workspace dependency. Keep all existing `dependencies` and `devDependencies` unchanged:

```json
{
  "name": "@bs-kara/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "NODE_OPTIONS='--max-old-space-size=8192' next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:rules": "vitest run --config vitest.rules.config.ts",
    "test:rules:emulator": "firebase --project demo-bs-kara emulators:exec --only database 'npm run test:rules'"
  },
  "dependencies": {
    "@bs-kara/shared": "workspace:*",
    "@hello-pangea/dnd": "^18.0.1",
    "@types/react-youtube": "^7.6.2",
    "canvas-confetti": "^1.9.4",
    "firebase": "^12.12.1",
    "firebase-admin": "^13.9.0",
    "i18next": "^26.0.8",
    "lucide-react": "<copy from existing package.json>",
    "next": "16.2.4",
    "qrcode.react": "^4.2.0",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "react-i18next": "^17.0.4",
    "react-youtube": "^10.1.0",
    "use-debounce": "^10.1.1",
    "yt-search": "^2.13.1"
  }
}
```

> The JSON above is illustrative — **copy all exact version strings from the original `package.json`** (which is now at `bk-web/package.json` after the git mv in Task 7). The only net changes are: add `"name": "@bs-kara/web"` at the top, and add `"@bs-kara/shared": "workspace:*"` as the first entry in `dependencies`. Keep `devDependencies` and `overrides` unchanged.

- [ ] **Step 8.2: Update `bk-web/next.config.ts`**

Add `transpilePackages` so Next.js compiles the TypeScript source from `bk-shared`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@bs-kara/shared'],
};

export default nextConfig;
```

- [ ] **Step 8.3: Update `bk-web/vitest.config.ts`**

Add the `@bs-kara/shared` resolver alias so Vitest can resolve the workspace package source directly without a build step:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
      '@bs-kara/shared': fileURLToPath(new URL('../bk-shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.tsx'],
    globals: false,
    css: false,
    include: ['{app,components,features,lib,hooks,tests}/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**', 'tests/rules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'features/**/*.{ts,tsx}',
        'lib/**/*.ts',
        'hooks/**/*.ts',
      ],
      exclude: [
        'app/**/layout.tsx',
        'app/**/page.tsx',
        'app/sitemap.ts',
        'app/robots.ts',
        'app/global-error.tsx',
        '**/*.d.ts',
      ],
    },
  },
});
```

- [ ] **Step 8.4: Verify `bk-web/tsconfig.json` paths**

The existing `tsconfig.json` has `"paths": { "@/*": ["./*"] }`. After the `git mv`, this now resolves `@/` to `bk-web/` which is correct. No changes needed. Verify:

```bash
cat bk-web/tsconfig.json | grep -A3 '"paths"'
```

Expected output contains `"@/*": ["./*"]`.

- [ ] **Step 8.5: Commit**

```bash
git add bk-web/package.json bk-web/next.config.ts bk-web/vitest.config.ts
git commit -m "chore(bk-web): configure as workspace package, add bk-shared dep"
```

---

## Task 9: Remove migrated files from `bk-web` and update imports

**Files:**
- Delete from `bk-web/`: all files that now live in `bk-shared`
- Modify: all `bk-web/` source files that import from deleted paths

- [ ] **Step 9.1: Delete shared files from `bk-web/`**

```bash
# Lib files now in bk-shared
rm bk-web/lib/firebase.ts
rm bk-web/lib/activeRoom.ts
rm bk-web/lib/roomPaths.ts
rm bk-web/lib/resetRoom.ts
rm bk-web/lib/config.ts
rm bk-web/lib/reactions.ts
rm bk-web/lib/ptDateKey.ts
rm bk-web/lib/i18n.ts
rm -rf bk-web/lib/random/
rm -rf bk-web/lib/scoring/
rm -rf bk-web/lib/text/
rm bk-web/lib/youtube/types.ts

# Hook files now in bk-shared
rm -rf bk-web/hooks/useRoom/
rm bk-web/hooks/useTransientNotice.ts

# Locales now in bk-shared
rm -rf bk-web/locales/
```

- [ ] **Step 9.2: Delete migrated test files from `bk-web/`**

```bash
rm bk-web/lib/activeRoom.test.ts
rm bk-web/lib/reactions.test.ts
rm bk-web/lib/text/normalize.test.ts
rm bk-web/lib/random/picker.test.ts
rm bk-web/hooks/useRoom/queue.test.ts
rm bk-web/hooks/useRoom/subscribe.test.ts
rm bk-web/hooks/useTransientNotice.test.ts
rm bk-web/hooks/useRoom.test.ts
```

- [ ] **Step 9.3: Bulk-update imports in `bk-web/` to use `@bs-kara/shared`**

Run from the repo root:

```bash
find bk-web -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.next/*" | xargs sed -i '' \
  -e "s|from '@/lib/firebase'|from '@bs-kara/shared'|g" \
  -e "s|from '@/lib/activeRoom'|from '@bs-kara/shared'|g" \
  -e "s|from '@/lib/roomPaths'|from '@bs-kara/shared'|g" \
  -e "s|from '@/lib/resetRoom'|from '@bs-kara/shared'|g" \
  -e "s|from '@/lib/config'|from '@bs-kara/shared'|g" \
  -e "s|from '@/lib/reactions'|from '@bs-kara/shared'|g" \
  -e "s|from '@/lib/ptDateKey'|from '@bs-kara/shared'|g" \
  -e "s|from '@/lib/i18n'|from '@bs-kara/shared'|g" \
  -e "s|from '@/lib/random/picker'|from '@bs-kara/shared'|g" \
  -e "s|from '@/lib/random/songPools'|from '@bs-kara/shared'|g" \
  -e "s|from '@/lib/text/normalize'|from '@bs-kara/shared'|g" \
  -e "s|from '@/lib/scoring'|from '@bs-kara/shared'|g" \
  -e "s|from '@/lib/scoring/index'|from '@bs-kara/shared'|g" \
  -e "s|from '@/lib/youtube/types'|from '@bs-kara/shared'|g" \
  -e "s|from '@/hooks/useRoom'|from '@bs-kara/shared'|g" \
  -e "s|from '@/hooks/useRoom/types'|from '@bs-kara/shared'|g" \
  -e "s|from '@/hooks/useTransientNotice'|from '@bs-kara/shared'|g"
```

- [ ] **Step 9.4: Verify no stale `@/` imports remain for moved modules**

```bash
grep -r "from '@/lib/firebase\|from '@/lib/activeRoom\|from '@/lib/roomPaths\|from '@/lib/config\|from '@/lib/reactions\|from '@/lib/i18n\|from '@/lib/random\|from '@/lib/scoring\|from '@/lib/text\|from '@/lib/youtube/types\|from '@/hooks/useRoom\|from '@/hooks/useTransientNotice" bk-web/ 2>/dev/null
```

Expected: **no output**. If any imports remain, update them manually.

- [ ] **Step 9.5: Commit**

```bash
git add -A
git commit -m "feat(bk-web): remove migrated files, update imports to @bs-kara/shared"
```

---

## Task 10: Update `playwright.config.ts` for new structure

**Files:**
- Modify: `playwright.config.ts` (at repo root)

- [ ] **Step 10.1: Update `playwright.config.ts`**

The webServer command needs to run from `bk-web/` since that's where the Next.js app now lives. The rest of the config (testDir, baseURL) stays the same — `e2e/` is still at the repo root.

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `cd bk-web && npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 10.2: Commit**

```bash
git add playwright.config.ts
git commit -m "chore: update playwright webServer command for bk-web/ location"
```

---

## Task 11: Install, typecheck, and verify

- [ ] **Step 11.1: Remove old `node_modules` and install with pnpm**

```bash
rm -rf node_modules bk-web/node_modules 2>/dev/null
pnpm install
```

Expected: pnpm creates a single `node_modules/` at repo root with symlinks for each workspace package. No errors.

- [ ] **Step 11.2: Typecheck `bk-shared` standalone**

```bash
cd bk-shared && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 11.3: Typecheck `bk-web` standalone**

```bash
cd bk-web && npx tsc --noEmit
```

Expected: zero errors. If there are import errors for `@bs-kara/shared`, verify:
1. `bk-web/package.json` has `"@bs-kara/shared": "workspace:*"` in dependencies
2. `pnpm install` was run from the repo root
3. `bk-shared/package.json` `exports` field points to `./src/index.ts`

- [ ] **Step 11.4: Run `bk-shared` tests**

```bash
cd bk-shared && pnpm test
```

Expected: all previously passing tests still pass. Fix any import path issues uncovered.

- [ ] **Step 11.5: Run `bk-web` Vitest tests**

```bash
cd bk-web && npx vitest run
```

Expected: all tests pass. Any test that imports a moved module should now resolve via `@bs-kara/shared` thanks to the vitest alias added in Task 8.3.

- [ ] **Step 11.6: Run `bk-web` build**

```bash
cd bk-web && npm run build
```

Expected: successful Next.js production build with no errors. The `transpilePackages: ['@bs-kara/shared']` in `next.config.ts` ensures Next.js compiles the TypeScript source.

- [ ] **Step 11.7: Run Playwright E2E**

```bash
npx playwright test
```

Expected: all E2E specs pass. The webServer now starts from `bk-web/` as configured in Task 10.

- [ ] **Step 11.8: Final commit**

```bash
git add -A
git commit -m "chore: verify monorepo migration — all tests and build green"
```

---

## Verification checklist

```
✅ pnpm install — clean with no errors
✅ typecheck (bk-shared) — zero errors
✅ typecheck (bk-web) — zero errors
✅ vitest (bk-shared) — N tests pass
✅ vitest (bk-web) — N tests pass
✅ next build (bk-web) — successful
✅ playwright — all E2E specs pass
```

---

## Appendix: what Plan 2 will cover

- Scaffold `bk-mobile/` (Expo + Expo Router + NativeWind)
- Scaffold `bk-mobile-ui/` (native component library)
- Implement remote (search, queue, settings) and TV screens using hooks from `@bs-kara/shared`
- Refactor `useRoom/mc.ts` to accept an injected `generateMcFn` so mobile can use a different (or no-op) MC generator
- Refactor `useAutoRandom` to accept an injected `searchFn` so mobile can use its own YouTube search client
- Configure EAS build for monorepo deployment
