# Architecture decisions — operational notes

This document tracks short-form operational notes about migration steps.
Long-form ADRs for the multi-room migration live at
`docs/multiple-rooms/architecture-decisions.md`.

## Step 0 Migration Note (May 3, 2026)

Commit 42cfba6 bundled the Step 0 work (Firebase rules tightening +
emulator test infrastructure) with the QR idle screen feature under a
`feat(qr-code)` message. The commit message does not reflect the full
scope. Step 0 files within that commit:

- `database.rules.json` (rules tightening)
- `firebase.json` (emulator config)
- `vitest.config.ts`, `vitest.rules.config.ts`
- `tests/rules/database-rules.test.ts`
- `tests/rules/fixtures/production-snapshot.json`
- `package.json`, `package-lock.json` (`firebase-tools`,
  `@firebase/rules-unit-testing`)

Test gates passing at the time of commit:
- Rules tests: 29/29 pass via emulator
- Vitest: 310/310 pass
- Typecheck, lint, build: clean
- Playwright: 24 pass; 6 pre-existing failures in
  `e2e/remote-mobile.spec.ts` (unrelated to Step 0, tracked separately)

Step 0 was intended to land as a separate PR but was inadvertently
bundled due to dirty working tree at commit time.

**Workflow change going forward:** Migration steps will be done on
isolated feature branches with PRs to prevent recurrence. Pre-flight
check requires clean working tree before starting any step.
