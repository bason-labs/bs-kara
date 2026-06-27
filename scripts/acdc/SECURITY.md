# ACDC security model — merge authority

The autonomous worker is **untrusted**: it runs `claude -p` with a build/test toolchain,
so it can execute arbitrary code with whatever GitHub credential is in scope. Command
deny-lists in `.claude/acdc-settings.json` (no `gh pr merge`, no `gh api` writes, no
`--add-label`, no push to `main`) are **defense-in-depth speed bumps, not a boundary** —
a script run via the allowed `node`/`tsx` could call `gh`/`git` directly and skip them.

## Important limitation: the worker runs as your gh identity

We tried to run the worker as a separate least-privilege **bot** (via `GH_TOKEN` /
`GH_CONFIG_DIR`), but **Claude Code's headless worker uses the machine's gh keyring login
and ignores those env vars** — verified empirically: in a clean env, `gh api user` inside
`claude -p` returns the keyring account (`thienba`) even with `GH_TOKEN=<bot>` set, while the
*same* `GH_TOKEN` in a plain shell returns the bot. (A plain `gh` honors `GH_TOKEN` per its
documented precedence; the Claude Code headless worker does not — so this is specific to how
Claude Code invokes `gh`, not gh in general.) On a single host where you're logged into `gh`
as yourself, **the worker therefore runs as you (admin)**, and there is no env knob to change
that.

Consequences:
- The worker authors PRs as **you**, not a bot.
- The "worker is non-admin, so it physically cannot merge" guarantee is **not enforced by
  the credential**. The worker *could* merge via your admin gh; what actually stops it is the
  runbook + CodeRabbit + the watcher being the only thing that runs a merge — not the token.

The only way to get true credential separation is to run the worker in a context whose gh
login **is** a non-admin bot (a dedicated machine / VM / CI runner). Until then, the model
below is the realistic posture.

## Roles (single-host posture)

- **Worker = proposer only.** It opens a green, CodeRabbit-reviewed PR (`Closes #N`) and
  **stops** — it never merges and never changes labels. Enforced by the runbook
  (`acdc-run/SKILL.md` step 11) + `acdcRunPrompt` + the settings deny-list. This is
  honor-system at the credential level (the worker has your admin gh) but has held in
  practice (the worker opens PRs and does not merge).
- **Watcher = the only thing that performs a merge.** Each poll it merges PRs that pass every
  gate below.

## What the watcher enforces (code — `runMergeStep`)

1. **Issue-anchored authorization** — `auto-merge` is read from the **issue** (the human's
   ticket), never the PR (`buildMergeInput(pr, issueLabels)`), so a PR-applied label can't
   authorize a merge.
2. **Strict PR↔issue binding** — `resolveGatingIssue` requires the PR head `run/issue-N` to
   match exactly one `Closes #N`; otherwise fail-closed. This is the cross-binding defense
   (PR authorship is not filtered, since the worker authors as you).
3. **Human authorship of the label** — the `auto-merge` label must have been applied by a
   **User-type** actor (`appliedByHuman` over the issue timeline filtered to `actor.type ==
   "User"`), so a non-User bot (a GitHub App / Action) can't authorize a merge. NOTE: this
   cannot distinguish you from the worker-running-as-you; that boundary is the runbook.
4. **CI + independent review** — required checks green **and** CodeRabbit `APPROVED`
   (`decideMerge` / `computeIndependentGate`); `COMMENTED`-only or absent ≠ pass.
5. **No worker mid-run** — PRs whose worker is still inflight are skipped.
6. **In-review + agent-ready** — only board tickets in *In review* and labelled `agent-ready`.
7. **Per-window cap** — at most `maxAutoMergesPerWindow`, re-checked and persisted per merge.

## Autonomous merge (opt-in — `ACDC_AUTO_MERGE_WITHOUT_LABEL`)

By default the watcher requires gate **1** (the issue's human-applied `auto-merge` label) and
gate **3** (that label being applied by a User actor). Setting
`ACDC_AUTO_MERGE_WITHOUT_LABEL=1` (in `~/.acdc/board.env` or the launchd env) **drops gates 1
and 3 only** — every other gate stays hard: strict PR↔issue binding (2), CI green +
CodeRabbit `APPROVED`/Sonar (4), no worker mid-run (5), *In review* + `agent-ready` (6), the
per-window cap (7), and the server-side `protect-main` ruleset.

What this changes in the trust model:

- **Authorization moves entirely to intake.** `agent-ready` is a human-only label (an
  external user cannot self-assign agent work on the public repo), so a human still decides
  *which* tickets the agent works on. Autonomous merge removes only the *second* human
  checkpoint, not the first.
- **No human reviews the diff before it lands on `main`.** CodeRabbit + CI + the
  `protect-main` required checks become the only result-level review. They catch
  implementation defects but can miss *spec-level* bugs (a faithfully-built wrong
  requirement), so an in-scope, green, CodeRabbit-approved-but-wrong change can reach `main`.
- The `auto-merge` label still works when present; the flag only removes the *requirement*,
  and `maxAutoMergesPerWindow` still rate-limits autonomous merges.

Default is **off** — the flag must be set explicitly and can be unset at any time to restore
the human gate. Recommended only when you trust your `agent-ready` intake discipline and the
CodeRabbit gate for the classes of ticket you let the agent take.

## Branch protection on `main` (server-side)

The `protect-main` ruleset requires a PR, the checks `build-test` + `scope-gate` +
`secret-scan` + **CodeRabbit**, and **1 approving review**, with the admin
(`RepositoryRole`) bypass **kept**. The security boundary here is the *merge-rights
restriction* — a non-bypass actor cannot merge without an approval (which it can't
self-give) and the required checks — not role status by itself. The admin bypass lets you
(and the watcher, running as you) merge your own and the agent's PRs; without it a solo
maintainer couldn't merge their own PRs (you can't self-approve). On a single host the
bypass is therefore the maintainer's convenience, not a worker boundary (the worker shares
your admin identity); the worker boundary is the runbook + CodeRabbit gate above.

## To make it truly airtight (optional, future)

Run the worker on a separate host/VM/CI runner whose gh login is a dedicated **non-admin**
bot account. Then the worker physically cannot merge or push to `main`, and the credential
becomes the boundary. The watcher can stay on your machine (as you) to perform the merges.
