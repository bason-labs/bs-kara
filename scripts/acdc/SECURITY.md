# ACDC security model — merge authority

The autonomous worker is **untrusted**: it runs `claude -p` with a build/test toolchain,
so it can execute arbitrary code with whatever GitHub credential is in scope. Command
deny-lists in `.claude/acdc-settings.json` (no `gh pr merge`, no `gh api` writes, no
`--add-label`, no push to `main`) are **defense-in-depth speed bumps, not a boundary** —
a script run via the allowed `node`/`tsx` could call `gh`/`git` directly and skip them.

**The real boundary is the GitHub credential plus server-side branch protection.**

## Roles

- **Worker = proposer only.** It opens a green, CodeRabbit-reviewed PR (`Closes #N`) and
  stops. It never merges and never changes labels (the runbook + `acdcRunPrompt` say so,
  and the settings deny the obvious paths).
- **Watcher = sole merge authority.** Each poll it merges PRs that pass every gate, reading
  the `auto-merge` label from the **issue** (the human's ticket), never from the PR.

## What the watcher enforces (code — `runMergeStep`)

1. **Issue-anchored authorization** — `auto-merge` is read from the issue, not the PR
   (`buildMergeInput(pr, issueLabels)`), so a PR-applied label can never authorize a merge.
2. **Strict PR↔issue binding** — `resolveGatingIssue` requires the PR head `run/issue-N` to
   match exactly one `Closes #N`; otherwise fail-closed.
3. **Human authorship** — the `auto-merge` label must have been applied by a human, verified
   against the issue timeline (`appliedByHuman`); a label applied only by the worker bot is
   rejected. The bot login is derived from the worker token itself, never hand-entered.
4. **CI + independent review** — required checks green **and** CodeRabbit `APPROVED`
   (`decideMerge` / `computeIndependentGate`); `COMMENTED`-only or absent ≠ pass.
5. **No worker mid-run** — PRs whose worker is still inflight are skipped.
6. **Per-window cap** — at most `maxAutoMergesPerWindow`, re-checked and persisted per merge.

If a separate worker identity is **not** configured, the watcher **refuses to dispatch or
merge at all** (fail-closed) — it never lets the worker run with its own privileged identity.

## Required operator setup (`~/.acdc/worker-token.env`)

The worker must authenticate as a **least-privilege, non-admin identity** distinct from the
watcher's. Recommended: a dedicated bot GitHub account added as a **write (non-admin)**
collaborator, with a fine-grained PAT scoped to this repo (Contents R/W, Pull requests R/W,
Issues R/W).

```
# ~/.acdc/worker-token.env   (chmod 600)
GH_TOKEN=<the worker bot's fine-grained PAT>
```

The watcher derives the bot's login from this token at runtime (`gh api user`).

## Required branch protection on `main` (server-side — the actual enforcement)

In **Settings → Rules / Branch protection** for `main`:

- **Require a pull request before merging** (blocks direct pushes).
- **Required status checks:** `build-test`, `scope-gate`, `secret-scan`, **CodeRabbit**.
- **Require 1 approving review.** The worker bot authors PRs and cannot approve its own, so
  it cannot merge; only the watcher (your identity) approves + merges.
- **Disable "allow bypass" / admin bypass**, so the rules bind every identity — including an
  org owner — and the command-level worker token cannot route around them.

With this in place, even if the worker escapes the command deny-list via arbitrary code, its
token cannot merge, cannot self-approve, and cannot push to `main`.
