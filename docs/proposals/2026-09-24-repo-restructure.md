# Proposal: Repository Restructure & Testing Standard

- **Status:** Accepted in part (see §9)
- **Date:** 2026-09-24
- **Goal:** Make bs-kara easy to read, navigate and track, and ready to add a standalone
  server and infrastructure-as-code without another big reshuffle.

---

## 1. What large engineering orgs converge on

This section covers the conventions that show up in Google, Shopify, Vercel/Turborepo,
Cal.com and similar large TypeScript monorepos, and how each one applies to this repo.

| Practice | Who does it | What it means here |
|---|---|---|
| **`apps/` are thin, `packages/` are thick** | Turborepo guidance, Cal.com (`apps/web` + `@calcom/features`) | Deployables only wire things together. Business logic lives in packages that any app (web, mobile, future API server) can import. |
| **One purpose per package, no nested packages** | Turborepo | `bk-shared` is currently a grab-bag. Split it by purpose. |
| **Enforced module boundaries** | Google (Bazel `visibility`), Shopify (Packwerk), Nx (`enforce-module-boundaries`) | A lint rule decides who may import what, not reviewer memory. |
| **Ports & adapters (hexagonal)** | Common in service code at every large org | Server logic doesn't know it runs in Next.js. Route handlers are ~5-line adapters, so moving to a standalone server means changing the adapter and leaving the logic alone. |
| **Validated config, 12-factor** | 12factor.net, standard everywhere | One typed, zod-validated env module that fails fast at boot. No `process.env.X` scattered across files. |
| **Test sizes, not test names** | Google SWE book (ch. 11) | Classify tests as *small / medium / large* by what resources they're allowed to touch, and aim for about 80/15/5. |
| **Hermetic tests** | Google | Each test sets up and tears down its own world, with no shared live Firebase and no network. |
| **Colocated tests + shared test utilities** | Most JS monorepos | `foo.ts` sits next to `foo.test.ts`. Factories and MSW handlers come from one `test-utils` package. |
| **Affected-only CI, required checks, CODEOWNERS** | Google TAP, Turborepo `--filter=...[origin/main]` | Every PR runs lint, typecheck, test and build only for what changed, and merging is blocked until those checks pass. |
| **ADRs (Architecture Decision Records)** | Widely used (Nygard format) | Short numbered records of *why* a decision was made. They sit alongside plans and specs, which record *what* was built. |

---

## 2. Audit of the current repo

Findings from reading the tree as of `cd6ca78`:

### Structure
0. **Principle for this migration:** remove what's redundant *before* adding anything. New
   tooling (CI, boundary lint, Storybook, infra) lands only when a step actually needs it.
1. **Top-level folders don't say what they are.** `bk-web`, `bk-mobile` and `bk-shared` sit
   at the root next to `scripts/acdc`, which is also a workspace package. A newcomer can't
   tell deployables from libraries.
2. **`pnpm-workspace.yaml` lists `bk-mobile-ui`, which doesn't exist.**
3. **The root `package.json` depends on `expo`, `react-native` and `react`** and has
   `android`/`ios` scripts. These were added on purpose in `c56c48c` to fix Android runtime
   errors under `node-linker=hoisted`, so they stay until Step 1 can verify an Android build
   without them. The root `react: 19.0.0` override means the *whole* repo, web included,
   runs React 19.0.0 (React Native 0.79 requires it). `bk-web` and `bk-shared` used to
   declare 19.2.4, which was never what actually ran. Step 0 aligned the declarations.
4. **`bk-shared` mixes four concerns:** pure domain (scoring, random picker, reactions,
   normalize), the Firebase client adapter (`firebase.ts`, `roomPaths`, `activeRoom`),
   React hooks (`useRoom`), and i18n + locales. It also pins `i18next ^23` while web
   uses `^26`.

### Server code is tangled into the Next.js app
5. Server logic is spread across `app/api/*/route.ts`, `features/voice/server/`,
   `features/admin/lib/firebaseAdmin.ts`, `lib/youtube/server.ts`, `lib/subscriptions/`
   and `lib/analytics/`.
6. **The layering is inverted:** `lib/subscriptions/repo.ts` and
   `lib/analytics/serverAnalytics.ts` import from `features/admin/lib/firebaseAdmin`.
   Shared code should never depend on a feature.
7. `process.env` is read directly in about 24 source files. There is no validated env
   schema, even though CLAUDE.md Rule 3 asks for one.
8. **What's already good:** `app/api/voice/turn/route.ts` is already a thin adapter over
   `VoiceService`. That's the pattern to copy everywhere.

### Duplication between web and mobile
9. About 1,000 lines of near-identical hook logic are forked between `bk-web/hooks` and
   `bk-mobile/hooks`: `useMCPlayer` (245/269 lines), `useAIVoice` (290/260),
   `useAutoRandom`, `useAdMask`, `useSongScore`, `useRoomGate`, `useSearchSuggestions`,
   `useSearchHistory`, `useCurrentHost` and `usePhoneAuth`. The `web-mobile-sync` skill
   exists to port features by hand, which is a sign the logic belongs in a shared package.

### Readability
10. Some files are too big to review: `RemoteClient.tsx` has 890 lines and `SearchPanel.tsx` has 821.
11. Test placement is inconsistent. Most tests are colocated, but some sit in `__tests__/`
    folders (`components/__tests__`, `hooks/__tests__`, `sections/__tests__`).
12. **There is no CI at all.** `.github/workflows/` is empty (the gates were removed in
    `87f426b`), yet CLAUDE.md and ACDC both describe a CI `scope-gate`.
13. The docs are stale or mixed. CLAUDE.md says Next.js 15, but `bk-web` is on Next 16.2.
    The Makefile mixes `npm`, `npx` and `pnpm`. `docs/superpowers/` holds 28 tool-generated
    plans and specs, and there is no index of decisions.
14. Root-level test and build outputs (`e2e/`, `playwright.config.ts`, `database.rules.json`)
    belong to specific apps but live at the root. The Playwright web server runs
    `cd bk-web && npm run build`.

---

## 3. Target structure

```
bs-kara/
├── apps/                         # deployables only, kept thin
│   ├── web/                      # Next.js: UI + thin route-handler adapters
│   │   ├── app/                  #   routing only (page.tsx, layout.tsx, route.ts)
│   │   ├── features/             #   remote/, tv/, admin/, register/, voice/
│   │   │   └── <feature>/
│   │   │       ├── components/
│   │   │       ├── hooks/
│   │   │       └── index.ts      #   the ONLY import surface for other features
│   │   ├── components/ui/        #   cross-feature presentational components
│   │   └── e2e/                  #   Playwright specs + playwright.config.ts
│   ├── mobile/                   # Expo app (same features/ convention)
│   └── api/                      # FUTURE: standalone server (see §5)
│
├── packages/                     # all shared logic
│   ├── domain/                   # pure TS, zero runtime deps: room/queue model, scoring,
│   │                             #   random picker, reactions, text normalize, types
│   ├── contracts/                # zod schemas: API request/response + RTDB node shapes
│   ├── firebase-client/          # client SDK adapter: init, roomPaths, activeRoom, subscribe
│   ├── client-core/              # platform-agnostic React hooks (useRoom, useAutoRandom,
│   │                             #   useMCPlayer, useAdMask…) with injected platform ports
│   │                             #   (audio player, storage, TTS fetcher)
│   ├── server-core/              # server-only services, framework-agnostic:
│   │   ├── youtube/              #   search + key rotation + quota fallback
│   │   ├── mc/                   #   MC line generation (OpenAI / Gemini)
│   │   ├── tts/
│   │   ├── voice/                #   (moved from apps/web/features/voice/server)
│   │   ├── subscriptions/
│   │   ├── analytics/
│   │   └── firebase-admin/       #   the ONE place firebase-admin is initialised
│   ├── design-tokens/            # colors, spacing, radii, typography, motion as TS + CSS
│   │                             #   vars; consumed by ui (Tailwind), mobile (NativeWind)
│   ├── ui/                       # reusable React (web) component library + Storybook
│   │   ├── .storybook/
│   │   └── src/<Component>/      #   Component.tsx, Component.stories.tsx, Component.test.tsx
│   ├── config/                   # env schema: serverEnv / clientEnv (zod, fail-fast)
│   ├── i18n/                     # locales + i18next init
│   └── test-utils/               # factories, MSW handlers, emulator helpers, fixtures
│
├── tooling/                      # config and dev tools, not product code
│   ├── tsconfig/                 # base.json, nextjs.json, react-native.json, node.json
│   ├── eslint-config/            # shared rules + boundary rules
│   ├── vitest-config/
│   └── acdc/                     # moved from scripts/acdc
│
├── infra/                        # FUTURE: IaC + deploy config
│   ├── firebase/                 # database.rules.json, firebase.json, rules tests
│   └── terraform/ (or pulumi/)
│
├── docs/
│   ├── adr/                      # 0001-monorepo-layout.md, 0002-…  (numbered, immutable)
│   ├── architecture/             # overview.md + diagrams (kept current)
│   ├── runbooks/                 # deploy, rotate YouTube keys, restore RTDB…
│   ├── proposals/                # this doc
│   └── plans/                    # superpowers plans/specs (archived history)
│
├── .github/
│   ├── workflows/ci.yml
│   └── CODEOWNERS
├── turbo.json  pnpm-workspace.yaml  package.json (tooling only, no app deps)
└── README.md                     # 1-screen map of the repo + "start here"
```

### Dependency rules (enforced by lint, not by convention)

```
apps/*            → may import any packages/*
ui                → design-tokens only (no Firebase, no domain, no app state)
client-core       → domain, contracts, firebase-client, i18n
firebase-client   → domain, contracts
server-core       → domain, contracts, config
contracts         → domain
domain            → nothing
packages/*        ✗ never import apps/*
apps/web/features/A ✗ never deep-import features/B (only features/B/index.ts)
client-side code  ✗ never import server-core (enforced with `server-only`)
```

Enforce these with `dependency-cruiser` (or `eslint-plugin-boundaries`) running in CI.
This is the lightweight version of what Bazel `visibility` and Shopify's Packwerk do.

### Why split `domain` from `client-core` from `server-core`
- `domain` is pure, so its tests are *small* (milliseconds, no mocks) and it can be reused
  by web, mobile and the future API unchanged.
- `server-core` is where the future `apps/api` gets its logic for free. Next.js route
  handlers and a Hono/Fastify server both become thin adapters over the same services.
- `client-core` ends the web↔mobile fork. Platform differences (expo-av vs `<audio>`,
  AsyncStorage vs localStorage) are injected as small *ports*, and the hook logic is
  written once.

### Naming conventions
- Package names: keep the `@bs-kara/*` scope (`@bs-kara/domain`, `@bs-kara/server-core`…).
- Files: `camelCase.ts` for modules and hooks, `PascalCase.tsx` for components (already the
  norm here).
- Each package gets a short `README.md` covering what it's for, its public API and who may
  depend on it, plus an `index.ts` barrel. Nothing outside the package imports its `src/`
  internals.
- Keep components and files under about 300 lines as a soft limit. Split `RemoteClient` and
  `SearchPanel` into composed sub-components and hooks.

---

## 4. Testing standard

### 4.1 Classify by size (Google model)

| Size | May touch | Runner | Lives in | Examples here |
|---|---|---|---|---|
| **Small** | A single process only. No network, no timers without fakes, no Firebase | Vitest (`node` env) | `*.test.ts` next to source | scoring, random picker, normalize, key rotation, zod contracts, reducers |
| **Medium** | Local processes: jsdom, MSW, Firebase **emulator** | Vitest (`jsdom`) / Jest (mobile) | `*.test.tsx`, `*.int.test.ts` | component logic with Testing Library, route handlers, RTDB rules, repos against emulator |
| **Large** | Built app + browser + emulator | Playwright | `apps/web/e2e/*.spec.ts` | join room, search → add → TV plays, End Party |

**Target mix:** about 70% small, 25% medium, 5% large. The UI-heavy parts of the app lean
more on medium tests (the "testing trophy" view), while `domain` and `server-core` should
be almost all small tests.

### 4.2 Rules
1. **Colocate.** `foo.ts` sits next to `foo.test.ts`. Drop the `__tests__/` folders.
2. **Suffix encodes size:** `*.test.ts` is small or medium, `*.int.test.ts` needs the emulator
   (it runs as a separate Vitest project), and `*.spec.ts` is Playwright.
3. **Hermetic.** No real network: MSW handlers come from `@bs-kara/test-utils`, and Firebase
   is always the emulator. Each test seeds its own room ID, and nothing is shared across tests.
4. **Factories over fixtures.** Use `makeQueueItem({ title: 'X' })` and `makeRoomState()` in
   `test-utils`, so a change to a type breaks at one place.
5. **Contract tests are free with zod.** The same `contracts` schema validates the real route
   response *and* the MSW mock, so mocks can't drift from the server.
6. **Test behaviour through the public API.** Test hooks via `renderHook`, components via
   `getByRole`, and never mock the unit under test. (Existing CLAUDE.md Rules 1–5 stay; they
   already match industry practice.)
7. **Coverage thresholds per package, not global:** `domain` ≥ 90%, `server-core` ≥ 80%,
   apps ≥ 60% of lines, with the thresholds enforced in each package's `vitest.config`.
8. **Mobile keeps Jest (`jest-expo`).** Vitest's React Native support is still weak. Shared
   packages use Vitest, so their tests run once and cover both apps.
9. **E2E projects.** Add a mobile-viewport Playwright project (the remote *is* a phone UI).
   Seed state through the emulator, not through the UI.
10. **Flakes are bugs.** CI retries only to *report* flakiness. A flaky test gets an issue and
    a fix, never `.skip`.

---

## 5. Shared UI library + Storybook

**Goal:** a component library that bs-kara *and future apps in the same system* can consume,
documented and tested in Storybook. This is the design-system pattern used by Shopify
Polaris, GitHub Primer and Atlassian.

### Packages
- **`@bs-kara/design-tokens`**: the single source of truth for color, spacing, radius,
  typography and motion. It is written once in TS and generates CSS variables for web and a
  JS theme object for NativeWind/React Native. The neon palette that currently lives in
  `globals.css` and `bk-mobile/constants/colors.ts` moves here.
- **`@bs-kara/ui`**: React DOM components styled with Tailwind v4 on top of the tokens.
  - **Primitives:** Button, IconButton, Toggle, Chip, Sheet, Dialog, Toast, Skeleton,
    OTPInput, Tabs.
  - **Composites:** SongRow, NowPlayingCard, QueueItem. They take plain props only, with
    no Firebase or room state.
  - Existing candidates to promote: `ConfirmDialog`, `OTPInput`, `ThemeToggle`, the
    skeletons, `SettingsSheet/primitives/*` and `EmojiPad`.

### Rules
1. **Presentational only.** Data comes in as props and events go out as callbacks. Anything
   that needs `useRoom` stays in `apps/web/features/*`. That's what makes the library
   reusable by another app.
2. **Every component ships three files:** `X.tsx`, `X.stories.tsx` (covering every visual
   state: default, loading, empty, error, disabled, dark/light) and `X.test.tsx` (behaviour
   only).
3. **Storybook is also a test runner.** Stories run as tests (Storybook's Vitest addon, with
   `play` functions for interactions), the a11y addon fails on violations, and visual
   regression is optional later (Chromatic or Playwright screenshots of stories).
4. **Accessible by default.** Use Radix/React Aria primitives underneath rather than
   hand-rolled focus traps.
5. **Public API = `src/index.ts`.** Semver it with **Changesets**. It is consumed through
   `workspace:*` inside the monorepo, and published to a private registry (GitHub Packages
   or Verdaccio) once an app *outside* this repo needs it.
6. **Storybook deploys as a static site.** It's just `storybook build` → nginx, and it
   becomes the living docs for the design system.

### Mobile
React Native components can't render in the web Storybook. Share **tokens now**. A
`packages/ui-native` with Storybook for React Native is a later step, and only if mobile
component reuse becomes real. Sharing tokens gives about 80% of the consistency for
about 10% of the cost.

---

## 6. Server and infra readiness (decision deferred)

The hosting direction is **self-managed: DigitalOcean + Kubernetes + Jenkins + Grafana**,
to be decided later. The restructure should keep that path cheap without building it now.
What that means today:

1. **Stay portable, avoid lock-in.** There are three Vercel-specific couplings to remove
   over time:
   - `apps/web/vercel.json`.
   - The `x-vercel-forwarded-for` header in `features/voice/server/http.ts`, which should
     become a configurable trusted-proxy header.
   - `unstable_cache` for YouTube search. It is per-instance, so with several k8s replicas
     it needs a shared cache (Redis) behind a `Cache` port in `server-core`.
2. **Container-ready apps.** Set `output: 'standalone'` for Next and add a `Dockerfile`
   per app (multi-stage, `turbo prune --docker`), plus a `/healthz` route (liveness) and a
   `/readyz` route (readiness).
3. **CI-tool-agnostic pipeline.** All logic lives in `package.json` + turbo scripts, so
   GitHub Actions today and a `Jenkinsfile` later both call the same
   `pnpm turbo run lint typecheck test build`.
4. **Grafana-ready observability.** Use pino JSON logs to stdout (collected by Loki), a
   Prometheus `/metrics` endpoint, and OpenTelemetry traces (sent to Tempo). Tag everything
   with a request ID.
5. **Standalone server when needed:** `apps/api` built on **Hono** (see below). It reuses
   `server-core` unchanged.
6. **`infra/` layout when the time comes:** `infra/k8s/` (Helm chart or Kustomize base +
   overlays per env), `infra/terraform/` (DO cluster, registry, DNS), `infra/firebase/`
   (rules), and `infra/jenkins/`.

**What is Hono?** Hono is a small, fast TypeScript web framework, similar to Express but
built on Web-standard `Request`/`Response`. That is the same interface Next.js route
handlers use, so a service in `server-core` works behind a Next route or a Hono route
without changes. It runs on Node in a Docker container, which suits k8s. The alternatives
are Fastify (mature, Node-only, also a good choice) and NestJS (heavier, Angular-style
DI). This decision can also wait until `apps/api` is needed.

**Config:** `@bs-kara/config` exports `serverEnv` (parsed once at boot, fails fast) and
`clientEnv`. In k8s these come from ConfigMaps/Secrets; locally they come from
`.env.local`. The code is the same either way.

---

## 7. CI and repo hygiene

- **Restore `.github/workflows/ci.yml`.** On each PR, run `pnpm install --frozen-lockfile`,
  then `turbo run lint typecheck test build --filter=...[origin/main]` (affected only), then
  the emulator suite (`*.int.test.ts` + rules), then Playwright. Make all of these required
  checks on `main`.
- **Add CODEOWNERS**, even solo. It's what the ACDC `scope-gate` already assumes for
  protected paths.
- **Renovate** (or Dependabot) for grouped dependency updates, and one React version across
  the repo.
- **commitlint** to enforce the Conventional Commits rule already in CLAUDE.md.
- **Single source of commands:** `package.json` scripts through turbo. Either the Makefile
  becomes a thin alias for `pnpm`, or it goes.
- **ADRs:** start with `0001-monorepo-layout`, `0002-testing-sizes`, `0003-server-core-ports`
  and `0004-hosting`. Fix the stale CLAUDE.md (Next 16, new paths).

---

## 8. Migration plan

Every step is its own branch and PR, is behaviour-preserving, and the existing tests must
pass unchanged (CLAUDE.md Rule 2, refactor clause). The order is chosen so each step is
small and reversible.

| # | Step | Size | Risk |
|---|---|---|---|
| 0 | ✅ **Clean up first, add nothing:** removed 2 dead web components, 14 never-wired mobile files from `ad40872` (plus tests), unused deps (`@types/react-youtube`, `expo-status-bar`, `react-native-qrcode-svg`), the orphaned `sonar-project.properties`, the duplicate `Makefile` and the dead `bk-mobile-ui` entry; aligned React declarations to 19.0.0. Tooling additions (CI, boundary lint) are deferred until needed | S | Low |
| 1 | ✅ **Rename** (`git mv`, history preserved): `bk-web`→`apps/web`, `bk-mobile`→`apps/mobile`, `bk-shared`→`packages/shared` (temporary); updated the workspace, lockfile importers, Metro workspace root, iOS `PODS_ROOT` paths, Playwright, vitest aliases, rules-test path, ACDC area globs and docs. `scripts/acdc` stays put for now: the live launchd watcher runs `pnpm -C scripts/acdc` from its own clone, so moving it needs a coordinated reinstall | S | Low (mechanical) |
| 2 | **Extract `tooling/tsconfig` + `eslint-config` + `vitest-config`** | S | Low |
| 3 | **Add `packages/config`** with a zod env schema; replace the ~24 direct `process.env` reads, and add tests for missing or malformed vars (CLAUDE.md Rule 3) | M | Medium |
| 4 | **Split `packages/shared`** into `domain`, `firebase-client`, `i18n` and `client-core` (for `useRoom`) | M | Medium |
| 5 | **Extract `packages/server-core`:** move `lib/youtube/server`, `generate-mc`, `tts`, `voice/server`, `subscriptions`, `analytics` and `firebaseAdmin`; route handlers become thin adapters. This fixes the lib→features inversion | M | Medium |
| 6 | **Add `packages/contracts`** (zod API + RTDB schemas) and `packages/test-utils` (factories + MSW) | M | Low |
| 7 | **De-duplicate web/mobile hooks** into `client-core` with platform ports, one hook per PR, starting with `useAdMask` (the smallest, 90/91 lines) | L | Medium |
| 8 | **Design system:** create `design-tokens` + `ui` with Storybook, then promote existing presentational components one PR at a time (starting with `ConfirmDialog`, `OTPInput` and the skeletons) | M | Low |
| 9 | **Web feature cleanup:** add a public `index.ts` per feature, split `RemoteClient` and `SearchPanel`, colocate `__tests__`; turn boundary lint to *error* | M | Low |
| 10 | **Containerize (when the infra decision is made):** standalone output, Dockerfiles, health/metrics routes, Vercel decoupling | M | Medium |
| 11 | **(When needed)** `apps/api` + `infra/` | L | n/a |

Steps 0–2 take about a day and deliver most of the "easy to read" win. Steps 3–6 make the
server extraction possible, and step 7 retires the web↔mobile sync burden.

---

## 9. Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Folder names | **`apps/` + `packages/` + `tooling/`** (decided 2026-09-24) |
| 2 | Server framework | Hono recommended; decide when `apps/api` is needed |
| 3 | Hosting | **Deferred.** Likely DigitalOcean + k8s + Jenkins + Grafana; keep the code portable now (§6) |
| 4 | Shared UI | **Yes:** `design-tokens` + `ui` with Storybook (§5) |
| 5 | Start point | Step 0 (restore CI + guardrails), then the Step 1 rename |

---

## Sources

- Turborepo, *Structuring a repository*: https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository
- Turborepo, *Internal packages*: https://turborepo.dev/docs/core-concepts/internal-packages
- *Software Engineering at Google*, ch. 11 "Testing Overview" (test sizes, hermeticity): https://abseil.io/resources/swe-book/html/ch11.html
- Mike Bland, *Small, Medium, Large*: https://mike-bland.com/2011/11/01/small-medium-large.html
- Cal.com architecture (apps/web + shared `@calcom/features`): https://deepwiki.com/calcom/cal.com
- Kent C. Dodds, *The Testing Trophy*: https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications
- Martin Fowler, *The Practical Test Pyramid*: https://martinfowler.com/articles/practical-test-pyramid.html
- Shopify Engineering, *Deconstructing the Monolith* (Packwerk / boundaries): https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity
- Nx, *Enforce module boundaries*: https://nx.dev/features/enforce-module-boundaries
- dependency-cruiser: https://github.com/sverweij/dependency-cruiser
- The Twelve-Factor App: https://12factor.net
- ADRs: https://adr.github.io
- Hono: https://hono.dev
- Storybook, *Vitest addon / component tests*: https://storybook.js.org/docs/writing-tests
- Changesets: https://github.com/changesets/changesets
- Turborepo, *Docker / `turbo prune`*: https://turborepo.dev/docs/guides/tools/docker
