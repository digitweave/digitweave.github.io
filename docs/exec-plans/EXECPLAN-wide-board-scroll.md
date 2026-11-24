# Enable board scrolling in the wide layout

This ExecPlan follows [PLANS.md](../../PLANS.md).

## Purpose and acceptance

At viewport widths of 1024px and above, a tall board should scroll inside
the center panel so players can reach lower rows and the append button.
Controls and Live Summary should stay in view while the board scrolls.
Below 1024px, the page should continue to scroll normally.

## Progress

- [x] (2026-11-24 09:14 UTC) Trace the wide layout and confirm the cause
  through independent review.
- [x] (2026-11-24 09:15 UTC) Reproduce the issue in Chromium at 1366×768.
- [x] (2026-11-24 09:15 UTC) Enable scrolling on the center panel and bump
  the app-shell cache to v8.
- [x] (2026-11-24 09:17 UTC) Verify wide and narrow scrolling, keyboard
  access, and cached assets.

## Surprises and discoveries

- The wide layout constrains `body` to the viewport and hides its overflow.
  The center `.board-panel` fills its grid area but does not scroll, even
  when its board and actions extend past the panel.
- The 216-cell browser fixture had 2010px of content in a 680px panel.
  Wheel input left both the page and the panel at their original position.

## Decision log

- 2026-11-24, Codex. Give the bounded panel vertical overflow in the wide
  media query. Bump the service worker cache so devices with the prior
  stylesheet can receive the fix.

## Context and milestones

`styles.css` defines the wide layout in the `min-width: 1024px` media query.
`index.html` places the toolbar, `#board`, append button, and hint inside
`.board-panel`. Make that panel scroll on overflow and bump `CACHE_NAME` in
`sw.js`, which precaches `styles.css`.

## Validation and recovery

From the repository root run `node --check app.js`, `node --check sw.js`, and
the scoped Git whitespace check. Use `npx --yes serve@latest . -l 8080` and
check HTTP 200 for `/`, `/sw.js`, and `/manifest.webmanifest`.

In disposable browser contexts, seed `numbers-game-web-state-v1` with an
active width-9 board of at least 216 uncrossed cells. At 1366×768 and at the
1024px breakpoint, use the wheel and Page Down to scroll the center panel.
Check that the panel reaches the final row and append button and that
the side panels stay in place. At 390px wide, scroll the page to the end.
Verify the current cache serves the updated CSS after an offline reload.

## Outcomes and retrospective

- Chromium at 1366×768 and 1024×580 confirmed that the mouse wheel and Page
  Down scroll the center panel while Controls and Live Summary stay in
  place. The final row and append button were reachable, and the resulting
  game progress persisted after reload.
- At 390×700 the page scrolled to the append button. The other browser smoke
  checks passed for manual and automatic play, history, and reset.
- Both JavaScript syntax checks and the scoped whitespace check passed.
  The app, worker, and manifest returned HTTP 200.
- A v7 client upgraded to v8 and loaded the new CSS offline. A fresh v8
  client also kept the fix and its board progress after an offline reload.
