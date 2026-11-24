# Audit and release the accumulated DigitWeave changes

This ExecPlan follows [PLANS.md](../../PLANS.md).

## Purpose and acceptance

Review and verify the working tree before committing and pushing the
DigitWeave updates to `origin/main`. Hint should produce the search strategy's
recommendation while the board and its controls remain responsive. Verify the
feature set in a browser and through an offline app-shell upgrade.

## Progress

- [x] (2026-11-24 11:02 UTC) Inspect the working tree and delegate
  independent gameplay, documentation, and offline reviews.
- [x] (2026-11-24 11:04 UTC) Verify the remote baseline and reproduce a
  long main-thread block from Hint.
- [x] (2026-11-24 11:09 UTC) Keep Hint responsive and verify rule
  equivalence and cancellation in Chromium.
- [x] (2026-11-24 11:10 UTC) Pass the release checks and confirm the staged
  scope and remote baseline before committing.

## Surprises and discoveries

- A Chromium run measured a synchronous Hint click at roughly 526ms with
  108 active digits, 2.3s with 216, and 5.3s with 432. These boards can be
  reached by appending without crossing first.
- The pre-existing `.devcontainer/devcontainer.json` edit changes tooling
  and the Codex volume. It is independent of the application release.

## Decision log

- 2026-11-24, Codex. Share the pure game rules and search between the app and
  a module worker. Run multiple-choice Hint searches off the UI thread and
  cancel a pending search on a board render. Keep the seeded recommendation.
- 2026-11-24, Codex. Keep the pre-existing devcontainer edit in the working
  tree. Stage the app and documentation paths explicitly.

## Context and milestones

`app.js` contains the pure rule and search functions alongside the UI.
Extract the shared rules into `game-rules.js` and add `hint-worker.js` for
the seeded search. Keep both files available to service worker clients via
`ASSETS`. Verify that the same input and seed produce the same legal pairs
and search result. In a large browser fixture, make a move while a Hint is
pending and confirm the result cannot mark the changed board.

## Validation and recovery

Run JavaScript syntax checks and check whitespace in the release paths.
Serve the repository as static files. Re-run browser scenarios for Hint,
selection, history, manual and automatic endings, accuracy, old saves,
column indicators, mobile tools, confetti, and offline upgrade. Use temporary
browser contexts with disposable saves and leave other working-tree changes
intact. After committing, verify the remote branch points at the new commit.

## Outcomes and retrospective

- The shared rules matched the previous pair order on 500 boards and seeded
  search on 75 multi-pair boards. Search keeps only scores and the top
  candidates in memory for the rollout stage.
- The 432-digit Hint click took around 1ms on the main thread after the
  change. The worker completed in about five seconds while Chromium rendered
  about 300 frames. Board changes canceled the search, and a worker load
  failure left controls available.
- Chromium passed manual and automatic play, history, Append, reset, mobile
  controls, column jumps, pair accuracy, configurable confetti, and reduced
  motion. JavaScript syntax, static HTTP, app and manifest assets, DOM IDs,
  documentation links, and staged whitespace passed.
- The exact v6 app shell upgraded to v15 and retired its old cache. The new
  modules served Hint offline. A v1 save kept its unscored crossing, recorded
  later legal moves, and restored the finished result on offline reload.
- `origin/main` matched the local base before release. The devcontainer edit
  was left outside the staged scope.
