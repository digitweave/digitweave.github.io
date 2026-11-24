# Add a configurable one-digit hint

This ExecPlan follows [PLANS.md](../../PLANS.md).

## Purpose and acceptance

In a running manual game, the center panel's Hint button highlights and
focuses one uncrossed digit from the pair recommended by search. Requesting
a hint leaves the current board, selected digits, and undo/redo history intact.
Players can hide or show the button in Controls and keep that choice on
reload. A board with no legal pairs gives a short message.

## Progress

- [x] (2026-11-24 09:20 UTC) Trace manual play and settings and delegate an
  independent review of pair detection and existing feedback behavior.
- [x] (2026-11-24 09:23 UTC) Add the button, setting, transient highlight,
  and cache update.
- [x] (2026-11-24 09:24 UTC) Verify the hint and its setting in Chromium.
- [x] (2026-11-24 09:25 UTC) Verify the cache upgrade and offline hint
  in Chromium.
- [x] (2026-11-24 09:47 UTC) Tie automatic match highlights to Validate
  selected pair and verify both checkbox states in Chromium.
- [x] (2026-11-24 10:24 UTC) Move Hint into the toolbar beside Undo and
  Redo and verify the icon at desktop and phone widths.
- [x] (2026-11-24 10:35 UTC) Use the search recommendation for Hint and
  verify it against Automatic Search on the standard starting board.

## Surprises and discoveries

- `findPairs()` already enumerates legal visible partners. `renderBoard()`
  replaces the board buttons on actions and settings changes, so a marker
  applied directly to a rendered digit has the desired transient lifetime.
- The feedback-before-append setting already checks for remaining pairs and
  returns a generic message. The requested button can be controlled separately
  from that passive feedback.

## Decision log

- 2026-11-24, Codex. Show one endpoint of the recommended pair. Focus the
  digit and scroll it into view for keyboard access and long boards. Use
  the existing pair rules and keep the hint as board feedback.
- 2026-11-24, Codex. Default the new Show Hint button setting to on in
  Manual mode. Persist it with the existing settings key. Keep feedback
  before append independent and clarify the Help wording.
- 2026-11-24, Codex. Render candidate colors only when Validate selected
  pair is on. Board selection and the separate Hint action use their own
  styles. Refresh the app shell for existing offline clients.
- 2026-11-24, Codex. Put the Hint lightbulb next to Redo in the existing
  toolbar so players can reach it with the other board actions on phones.
- 2026-11-24, Codex. Call the existing search strategy with a fresh random
  generator seeded from the game settings. Automatic Play keeps its own
  generator. Refresh the cached app shell.

## Context and milestones

`index.html` defines the center board controls and the Manual Round settings.
`app.js` renders the board and settings and owns `findPairs()`. `styles.css`
already has distinct styles for selected digits and possible partners.
Use a Hint icon beside Undo and Redo in the toolbar, a checkbox in Manual
Round, and a distinct one-digit highlight. The lead owns markup, JavaScript,
cache, and verification. A subagent can own the board button and marker
styles.

## Validation and recovery

From the repository root run `node --check app.js`, `node --check sw.js`, and
the scoped Git whitespace check. Serve with `npx --yes serve@latest . -l 8080`
and confirm HTTP 200 for `/`, `/sw.js`, and `/manifest.webmanifest`.

Use disposable browser state and seed a width-3 manual board with `[1, 9, 2]`
for a legal match and `[1, 2]` for no match. Check one marked digit, selection
and history, a no-pair message, keyboard focus, crossing and appending, and
setting changes, reload, and reset. Use a long board to locate a hint below
the fold. Verify the latest worker serves the updated button and CSS offline.

## Outcomes and retrospective

- Chromium checked that Hint marks one eligible digit, focuses it, and
  preserves the board, selections, and undo and redo. A no-pair board
  shows the expected message. Finished boards disable Hint.
- The checkbox defaults to on for older saves, persists through reload and
  new games, and returns to its default on reset. Automatic mode hides Hint.
  The separate append feedback check still blocks append when pairs remain.
- The highlight scrolls into view at 320px and 1366px. The standard manual,
  automatic, finish, and reset smoke checks passed.
- Both script syntax checks and the scoped whitespace check passed. The
  app, service worker, and manifest returned HTTP 200 on port 38987 because
  port 8080 was occupied.
- A fresh v9 install and a v6-to-v9 upgrade both served the hint offline.
  The upgraded worker discarded the old cache. The disabled setting also
  persisted across offline reload.
- Chromium reproduced the green candidate highlight with validation off.
  After the fix, both candidate colors followed the checkbox immediately.
  Selection, explicit Hint, and manual and automatic play passed. The v10
  cache served the fix and kept the validation setting on offline reload.
- At 320px, 381px, and 1366px the lightbulb fit beside Redo and activated
  from the keyboard. The toggle hid it, and the v13 cache served the icon
  and functional Hint offline. Board and finish-screen smoke checks passed.
- On the standard starting board, search Hint marked the same opening digit
  as Automatic Search, which differed from the first legal pair. Repeating
  the hint left the save unchanged. The v14 cache served the search hint
  offline, and the usual Hint, toggle, and viewport checks passed.
