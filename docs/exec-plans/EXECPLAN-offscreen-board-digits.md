# Fix the bottom offscreen digit strip

This ExecPlan follows [PLANS.md](../../PLANS.md).

## Purpose and acceptance

The bottom digit strip disappears when the last playable row is fully
visible. It continues to offer shortcuts when playable cells extend below
the desktop panel or mobile toolbar. Existing saves and offline play remain
compatible.

## Progress

- [x] (2026-11-25 07:11 UTC) Trace the board and sticky anchor measurements.
- [x] (2026-11-25 07:13 UTC) Reproduce the visibility failure and correct the boundary calculation.
- [x] (2026-11-25 07:15 UTC) Verify browser behavior and the offline shell update.

## Surprises and discoveries

The desktop sticky anchor can stop 12px inside the scrollport because of
panel padding. A 72-cell board at 1366×702 still showed the bottom strip
and clipped the board at panel scroll offset 76, with the full board
inside the scrollport.

## Decision log

- 2026-11-25, Codex. Measure bottom overflow against the panel scrollport
  or mobile toolbar edge. Keep using the sticky anchor to position the
  strip and its clipping boundary. Advance the app-shell cache to v17.

## Context and milestones

1. Measure the board, anchor, and viewport in Chromium with short and long
   boards in both layouts.
2. Correct the visibility check in `app.js` and advance the app-shell cache
   in `sw.js`.
3. Check the strip and clipping while scrolling and resizing. Verify the
   existing gameplay controls and reload the updated shell offline.

## Validation and recovery

Run the four JavaScript syntax checks from `AGENTS.md` and `git diff --check`
from the repository root. Serve the root with
`npx --yes serve@latest . -l 8080` and check the app, worker, and manifest
routes. Use a disposable browser profile. For the desktop regression,
load an active width-9 save with 72 uncrossed digits at 1366×702 and set
`.board-panel` scrollTop to 76. Check that the lower strip is hidden
and the board has no clip path. Scroll to the top to see the strip again.

## Outcomes and retrospective

- Chromium reproduced the desktop failure on v16. The same board fit
  without clipping or a bottom strip after the service worker upgraded
  to v17 and the page reloaded offline.
- At 390px wide, the bottom strip appeared on overflow, its shortcut
  scrolled to a digit, and the strip cleared after scrolling or resizing
  to fit. The desktop strip also reappeared when scrolling up.
- Manual crossing, undo, redo, append, automatic step, run, stop,
  reload persistence, and Reset Local Save passed in Chromium.
- All four JavaScript syntax checks and the whitespace check passed.
  The app, worker, and manifest returned HTTP 200.
