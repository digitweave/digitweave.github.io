# Collapsible Empty Rows And Narrow-Screen Auto Run

This ExecPlan follows [PLANS.md](../../PLANS.md).

## Purpose / Big Picture

After this change, players can collapse consecutive fully crossed board rows so the active part of the game stays visible, then toggle that behavior off to reveal the original full board. On narrow screens, starting automatic play with `Run` should also dismiss the overlay drawer so the player can immediately watch the board update behind it.

The change is observable in the browser by starting a game, creating or loading a board with multiple fully crossed rows, enabling the collapse toggle, and confirming those rows compress into a single minimal placeholder row that shows how many empty rows were hidden. On a narrow viewport, opening `Controls`, switching to `Automatic`, and pressing `Run` should close the drawer while auto-play continues on the board.

## Progress

- [x] (2026-03-20 15:11Z) Inspect repository instructions, confirm this task needs an ExecPlan, and map the affected areas in `index.html`, `app.js`, and `styles.css`.
- [x] (2026-03-20 15:18Z) Add a persisted board-view toggle for collapsing empty rows and implement render-time row grouping without changing gameplay indices.
- [x] (2026-03-20 15:18Z) Close narrow-screen drawers when automatic `Run` starts so the board remains visible during auto-play.
- [x] (2026-03-20 15:18Z) Run syntax checks and static-server smoke checks, capture isolated DOM validation, and document the final outcome and remaining manual-browser validation.

## Surprises & Discoveries

- Observation: The board is rendered as one flat CSS grid from `renderBoard()` in `app.js`; there is no separate row DOM structure today.
  Evidence: `renderBoard()` currently maps `state.cells` directly to button HTML and injects it into `#board`.

- Observation: Narrow-screen overlays are drawers, not separate route-level pages. The `Run` button lives inside the controls drawer.
  Evidence: `index.html` defines `#controls-drawer` and `app.js` starts automatic play from the `#auto-run-btn` click handler.

- Observation: A render-only collapse approach works cleanly with the existing flat board model; a simulated board with two consecutive fully crossed rows produced exactly one placeholder row and kept eight clickable cell buttons visible for the two non-empty rows.
  Evidence: Temporary isolated `jsdom` validation reported `collapsedRowCount: 1`, `collapsedLabel: "2 empty rows"`, and `visibleButtons: 8`.

- Observation: Closing the drawer at the start of `runAutoLoop()` is enough to fix the narrow-screen visibility issue.
  Evidence: The same isolated `jsdom` validation reported `drawerOpened: true`, `drawerClosedAfterRun: true`, and `backdropHiddenAfterRun: true` after clicking `Run`.

- Observation: The service worker cache version also needed to change because the feature updated `index.html`, `app.js`, and `styles.css`, which are all pre-cached app-shell assets.
  Evidence: `sw.js` caches those files through the `ASSETS` list under one `CACHE_NAME`, so leaving the previous cache name would risk stale installed/offline clients.

## Decision Log

- Decision: Implement empty-row collapsing purely at render time instead of mutating the saved game state or cell indices.
  Rationale: Pair search, append behavior, undo/redo, and click handling all rely on stable cell indices in `state.cells`; render-time grouping is the safest way to change the display without altering game rules.
  Date/Author: 2026-03-20, Codex

- Decision: Place the empty-row toggle in the controls drawer as a board-view setting that applies in both manual and automatic modes.
  Rationale: The feature is a persistent display preference, not a one-off action, and the controls drawer already houses mode and gameplay settings.
  Date/Author: 2026-03-20, Codex

- Decision: Bump the service worker cache name after the UI asset changes.
  Rationale: This repo treats service-worker caching as user-visible behavior, and a cache version bump is the safest way to ensure fresh assets load after the feature ships.
  Date/Author: 2026-03-20, Codex

## Outcomes & Retrospective

Completed:

- Added a new persisted `Collapse empty rows` checkbox to the controls drawer.
- Extended settings loading and saving without changing the storage key or breaking older saved settings.
- Refactored board rendering so consecutive fully crossed rows collapse into one minimal placeholder row showing the hidden-row count.
- Updated automatic `Run` so narrow-screen drawers close as play starts.
- Bumped the service worker cache from `numbers-game-pwa-v5` to `numbers-game-pwa-v6` so cached app-shell assets refresh after deployment.
- Updated the README and in-app help text so the new board-view behavior and current validation flow are documented.

Validation completed:

- `node --check app.js`
- `node --check sw.js`
- `curl -I http://127.0.0.1:8080/`
- `curl -I http://127.0.0.1:8080/sw.js`
- `curl -I http://127.0.0.1:8080/manifest.webmanifest`
- Temporary isolated `jsdom` checks for the collapsed-row DOM and the narrow-screen `Run` drawer behavior

Remaining follow-up:

- A real interactive browser smoke pass is still recommended to visually confirm the styling of the collapsed-row placeholder, manual play feel, and full auto/manual flows across responsive breakpoints.

## Context and Orientation

This repository is a static HTML/CSS/JavaScript PWA with no build step.

- `index.html` contains the board shell, the `Controls` drawer, and all DOM IDs used by the app script.
- `app.js` owns the whole game state, rendering, persistence, auto-play, and event binding.
- `styles.css` defines the board grid, drawers, dialog, and responsive layout.

Relevant current code paths:

- `DEFAULT_SETTINGS`, `loadSettings()`, `saveSettings()`, and `applySettingsToUI()` define the persisted settings shape and UI syncing.
- `renderBoard()` creates the board DOM from `state.cells`.
- `runAutoLoop()` starts automatic play, while `closeDrawers()` dismisses narrow-screen drawers.
- The board is still one logical flat list of cells in `state.cells`; a "row" in this plan means one consecutive slice of `state.width` cells in that flat array.

An "empty row" in this plan means a rendered board row whose cells are all already crossed. The new compact mode should hide consecutive empty rows behind a single visible placeholder row while preserving the original game logic and cell indices.

## Plan of Work

First, extend the settings model in `app.js` with a new boolean such as `collapseEmptyRows`, defaulting to enabled for newly loaded settings while remaining backward compatible with older saved settings that do not yet have the field. Add a corresponding checkbox in `index.html` inside the controls drawer and wire it into `applySettingsToUI()` and `attachEvents()`.

Next, refactor board rendering in `app.js` so `renderBoard()` computes logical rows from `state.cells` and `state.width`, groups consecutive fully crossed rows when the toggle is enabled, and renders either normal cell buttons or one minimal collapsed-row placeholder. The placeholder must remain visually aligned to the board grid and display the number of hidden empty rows. This must not change `state.cells`, `findPairs()`, click indices, undo/redo history, or append behavior.

Then, update `styles.css` so the board still looks like a grid when collapsed rows are present. The collapsed-row styling should be minimal and should not overpower active cells.

Finally, update the narrow-screen automatic-play flow in `app.js` so pressing `Run` closes open drawers before or as auto-play begins, without altering wide-screen always-open panels. After code changes, run the required syntax checks and static-server smoke checks, then note any manual-browser verification still required.

## Concrete Steps

Run from the repository root:

    node --check app.js
    node --check sw.js
    npx --yes serve@latest . -l 8080
    curl -I http://127.0.0.1:8080/
    curl -I http://127.0.0.1:8080/sw.js
    curl -I http://127.0.0.1:8080/manifest.webmanifest

Task-specific verification should also include loading the page in a narrow viewport and in a wider viewport, toggling the empty-row collapse setting, and starting automatic play from the controls drawer.

## Validation and Acceptance

Baseline validation:

    node --check app.js
    node --check sw.js
    curl -I http://127.0.0.1:8080/

Manual browser acceptance:

1. Open `http://127.0.0.1:8080/`.
2. Start a game and confirm the board renders and remains clickable in manual mode.
3. Create or load a board with consecutive fully crossed rows, enable the collapse toggle, and confirm those rows compress into one lightweight placeholder row with a hidden-row count.
4. Disable the collapse toggle and confirm the original full list of rows reappears without losing state.
5. On a narrow viewport, open `Controls`, switch to `Automatic`, press `Run`, and confirm the drawer closes while the board continues changing.
6. Confirm `Undo`, `Redo`, manual append, auto step/run/stop, reload persistence, and `Reset Local Save` still behave normally.

Acceptance is based on observable behavior: the board should be easier to scan during long games, the toggle should reveal the original row layout on demand, and automatic play should no longer remain hidden behind the narrow-screen drawer after `Run`.

## Idempotence and Recovery

The syntax checks, static server, and HTTP smoke checks are safe to re-run. If a partial implementation leaves unexpected settings in local storage, use `Reset Local Save` or remove the relevant local storage keys in the browser to restore the default state. Because the row collapse is render-only, the persisted game state should remain recoverable even if the display toggle changes.

## Artifacts and Notes

- Existing settings key: `numbers-game-web-settings-v1`
- Existing state key: `numbers-game-web-state-v1`
- Existing responsive breakpoint for always-open side panels: `min-width: 1024px`
- Updated service worker cache name: `numbers-game-pwa-v6`
- Syntax validation passed for `app.js` and `sw.js` on 2026-03-20.
- Static server smoke checks returned `HTTP/1.1 200 OK` for `/`, `/sw.js`, and `/manifest.webmanifest` on 2026-03-20.
- Isolated DOM validation results:
  `collapsedRowCount: 1`
  `collapsedLabel: "2 empty rows"`
  `visibleButtons: 8`
  `drawerOpened: true`
  `drawerClosedAfterRun: true`
  `backdropHiddenAfterRun: true`

These values matter because the new board-view toggle should be backward compatible with older saves and the auto-run drawer fix should only apply to the narrow-screen drawer layout.

## Interfaces and Dependencies

Files and interfaces expected to change:

- `index.html`: add the new empty-row collapse checkbox in the controls UI.
- `app.js`: extend `DEFAULT_SETTINGS`, `loadSettings()`, `applySettingsToUI()`, `attachEvents()`, and `renderBoard()`; update `runAutoLoop()` or the `Run` click path to close narrow-screen drawers.
- `styles.css`: style the new checkbox placement and the collapsed-row placeholder inside the board grid.

Browser APIs involved:

- `localStorage` for persisted settings.
- `window.matchMedia()` through the existing `WIDE_PANELS_QUERY`.
- DOM event listeners for settings changes and the `Run` button.
