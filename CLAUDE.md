# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commit conventions

Commit messages must contain ONLY a Conventional Commits subject and an
optional body that describes the change. The sole author must be the user.

DO NOT add any of the following to commit messages:
- `Co-Authored-By: Claude` (or any other Claude / Anthropic identity)
- `🤖 Generated with Claude Code` (or any variant)
- Any trailer, signature, or footer attributing the commit to Claude or
  Anthropic

This applies to every `git commit` (and amend / rebase) made in this
repository — no exceptions, even when the user explicitly approves a
change. If unsure, omit attribution.

## Commands

```bash
pnpm dev               # web dev server (turbo dev --filter=@bs-kara/web)
pnpm build             # production build (turbo build)
pnpm lint              # ESLint (turbo lint)
pnpm test              # Vitest, all workspaces (turbo test)
pnpm -C apps/web run typecheck      # tsc --noEmit for the web app
pnpm -C apps/web run test:rules     # Firebase rules suite (needs the emulator)
```

## App-specific guidance

Environment variables, architecture and data flow for the web app live in `apps/web/CLAUDE.md`;
the mobile app's environment lives in `apps/mobile/CLAUDE.md`. Both load automatically when
working in those folders — read `apps/web/CLAUDE.md` first when a change in `packages/shared`
touches room state, search, MC or auto-random.

---

## Testing

Vitest + Testing Library + MSW. Test behaviour that can break silently; skip the rest.

- **Test:** server code (`server/`), route handlers, hooks with state or effects, pure helpers
  with branches (parsing, validation, key rotation, fallbacks).
- **Don't test:** presentational components, config, thin glue, copy/styling, types.
- **Bug fix:** add one test that fails without the fix. Name it after the bug
  (`it('does not <bug> when <trigger>')`).
- **Keep tests small:** one test per behaviour; use `it.each` for input/output variants instead of
  copy-pasted tests. Mock dependencies (`fetch`, Firebase, APIs), never the unit under test.
- **Never** commit `.only`/`.skip`, weaken an assertion to go green, or delete a failing test
  without asking.

Before calling a change done, run and report:

```bash
pnpm exec turbo run build --filter=@bs-kara/web   # first: regenerates .next/types for tsc
pnpm exec turbo run typecheck lint test
```

If any step fails, stop and report it; don't skip or loosen tests to get green.
