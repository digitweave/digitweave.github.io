# Show a score and new-game choices when a round ends

This ExecPlan follows [PLANS.md](../../PLANS.md).

## Purpose and acceptance

When a manual or automatic round ends, the result dialog explains the outcome,
shows the percentage of all board digits crossed, and briefly displays a small
confetti flourish. The player can keep the final board or choose a mode and
board width and start a new game. Reduced-motion users see a static result.

## Progress

- [x] (2026-11-24 09:03 UTC) Read the repository guidance, trace game-ending
  paths, and delegate flow review and browser setup.
- [x] (2026-11-24 09:06 UTC) Integrate the result, new-game form, confetti,
  and app-shell cache change.
- [x] (2026-11-24 09:08 UTC) Verify manual and automatic endings, history,
  saves, responsive layout, and reduced motion in Chromium.
- [x] (2026-11-24 09:11 UTC) Verify the service worker upgrade and offline
  result in Chromium.

## Surprises and discoveries

- The existing result dialog is opened by `finishGame()` and already displays
  counters. The last crossed pair currently leaves the game active until
  Save Round or an additional automatic step.
- The existing `startNewGame()` accepts a board width. Mode and width already
  persist via the settings and state keys, respectively.
- The browser's default dialog size clipped the card edge on a narrow
  viewport. The dialog now owns the responsive width and the card fills it.

## Decision log

- 2026-11-24, Codex. Use the percentage of all board digits crossed as the
  score. Derive it from the final board so existing saves need no migration.
- 2026-11-24, Codex. Animate newly completed rounds and show a static result
  when a terminal state is restored. Finish immediately on crossing the last
  pair and use the existing new-game reset path after the player chooses a
  mode and width.

## Context and milestones

DigitWeave is a static, offline-capable game. `index.html` defines the result
dialog, `app.js` handles board actions and saves, and `styles.css` styles the
dialog. The lead owns HTML, JavaScript, service worker, and integration. A
subagent can style the dialog and animation independently in `styles.css`.

1. Update `tryCrossSelected()` and `runAutoStep()` to complete the round after
   the final pair. Reuse `finishGame()` for manual, automatic, and stalled
   endings and show the result when `init()` or redo restores a terminal save.
2. Expose the derived score and existing counters. Add manual or automatic
   mode and board width choices to the dialog. Use `startNewGame()` to clear
   history and persist the accepted selection through the existing paths.
3. Style the dialog across viewports and add a brief, decorative CSS confetti
   animation that honors reduced motion. Bump `CACHE_NAME` in `sw.js` so
   existing service worker clients receive the changed app shell.

## Validation and recovery

Run `node --check app.js`, `node --check sw.js`, and scoped `git diff --check`
from the repository root. Serve with `npx --yes serve@latest . -l 8080` and
confirm HTTP 200 for `/`, `/sw.js`, and `/manifest.webmanifest` with `curl -fsSI`.

Use disposable browser contexts and seed `numbers-game-web-state-v1` when a
nearly finished board is needed. An active width-3 board containing `[5, 5]`
solves after the matching pair. For a partial score, use `[5, 5, 1, 2]` with
the first two cells already crossed. That board stalls after append and
reports 33%. A saved cell is `{ digit, crossed }`, and the fixture needs
`width: 3`, `status: "active"`, and a `startedAt` timestamp. Verify the result,
animation and reduced motion, dismissing, undo and redo, reload, starting a
selected mode and width, reset, and automatic step/run/stop. Verify the
updated worker controls the page and serves the new UI offline after a
reload. Recreate browser state from the fixture for each check.

## Outcomes and retrospective

- Browser checks passed at 320px, 390px, and desktop widths. The 100% solved
  and 33% stalled fixtures showed the expected counters. The celebration ran
  once for a fresh result and was absent after redo, reload, or in reduced
  motion. Manual play, append, automatic step/run/stop, and history passed.
- The browser rejected an out-of-range width, allowed dismissal regardless,
  and accepted a valid mode and width via keyboard. The selected setup
  persisted on reload and Reset Local Save returned to the defaults.
- `node --check` passed for both scripts. The app shell, service worker, and
  manifest returned HTTP 200 from the documented static server.
- A fresh v7 worker controlled the page and cached the final dialog CSS.
  Finishing a round and starting a new one worked after an offline reload.
  In a separate context, the v6 worker upgraded, retired its cache, and
  loaded the new dialog. The saved round could finish offline after the
  upgrade.
