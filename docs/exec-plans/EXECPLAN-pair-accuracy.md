# Report pair accuracy at the end of a game

This ExecPlan follows [PLANS.md](../../PLANS.md).

## Purpose and acceptance

Players can continue to cross pairs freely by turning validation off. The
finish screen reports pair accuracy alongside the percentage of digits
cleared. A game with one legal and one forced crossing shows 50% accuracy,
even when the whole board is cleared. A saved round from before accuracy
tracking keeps its board and total crossings and identifies unscored moves.

## Progress

- [x] (2026-11-24 09:59 UTC) Trace the crossing, history, and saved-state
  paths and delegate an independent audit.
- [x] (2026-11-24 10:02 UTC) Track pair accuracy and integrate the final
  score presentation.
- [x] (2026-11-24 10:03 UTC) Verify gameplay, migration, responsive layout,
  and offline refresh.

## Surprises and discoveries

- With validation off, the manual path already calls `isLegalVisiblePair()`
  before deciding whether to force a crossing. Automatic play and its
  simulations use legal pairs from `findPairs()`.
- Older saves retain `pairMoves` and crossed cells. They contain no record
  of the pairing or visibility of the individual moves.

## Decision log

- 2026-11-24, Codex. Use the board rules at the time the crossing is made.
  Store valid and invalid crossing counts alongside `pairMoves` in the
  existing state key. The difference between their sum and `pairMoves` is
  the count of earlier unscored moves. Score newly recorded moves in a
  migrated round using the recorded denominator.
- 2026-11-24, Codex. Use a whole percentage with exact counts beside the
  existing completion score. Round down so 100% identifies a perfect result
  among recorded crossings. A round with zero recorded moves has no rate.

## Context and milestones

`app.js` owns `crossPairIndices()`, `loadState()`, and `showSummaryDialog()`.
Add counts in the shared crossing path so manual and auto moves are scored.
Search simulations mutate cloned boards, and the scalar counts travel with
the existing undo and redo snapshots. Migrate existing saves in place so
older, unrecorded moves still count toward the round total. `index.html`
provides two score tiles. A subagent can style them in `styles.css` while
the lead handles state, markup, and integration. Bump `CACHE_NAME` in `sw.js`
to refresh the app shell.

## Validation and recovery

From the repository root run `node --check app.js`, `node --check sw.js`, and
the scoped Git whitespace check. Serve with `npx --yes serve@latest . -l 8080`
and check HTTP 200 for `/`, `/sw.js`, and `/manifest.webmanifest`.

Use disposable Chromium contexts with width-3 boards. A `[1, 9, 2, 3]`
fixture with validation off can reach 50% accuracy by crossing the first
two cells legally and the last two by force. Include a digit match blocked
by visibility, rejected selections with validation on, undo and redo,
automatic play, and a stalled round. Load a v1 save with already-crossed
cells and positive `pairMoves` to verify migration, a later recorded move,
and reload. Verify score readability at 320px and desktop widths, and
exercise the updated app shell after a worker upgrade and offline reload.

## Outcomes and retrospective

- Chromium showed 50% accuracy for one valid and one forced crossing on a
  fully cleared board, and 0% for an entirely invalid clear. It rejected an
  invalid selection with validation on and classified a hidden pair as
  invalid even though its digits added to ten.
- Accuracy persisted after reload, undo and redo restored the counts, and a
  new game reset them. Automatic search counted its executed moves only. A
  stalled zero-crossing round showed no rate. Both tiles fit at 320px.
- Legacy and malformed accuracy fields preserved the board and its total
  crossings. The v10-to-v11 worker upgrade kept an earlier unscored crossing,
  recorded a new legal move offline, and preserved the result on reload.
- Both JavaScript syntax checks and the scoped whitespace check passed. The
  app shell, worker, and manifest returned HTTP 200. Manual and automatic
  finish, append, reset, and responsive regressions passed.
