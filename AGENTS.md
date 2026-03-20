# AGENTS.md

## Mission

This repository is a static browser game and installable PWA for the DigitWeave Numbers Game. Keep the project easy to serve from plain static hosting, especially GitHub Pages, and preserve the current offline-first behavior.

## When To Use An ExecPlan

Use an ExecPlan, as defined in `PLANS.md`, before starting any feature or refactor that is more than a tiny edit. In this repo, that especially means work that:

- changes gameplay rules, pair detection, append behavior, or auto-play heuristics in `app.js`
- changes saved-state shape, storage keys, or migration behavior in `app.js`
- changes responsive layout or drawer/dialog behavior across `index.html`, `styles.css`, and `app.js`
- changes offline behavior, caching, manifest data, or service worker assets in `sw.js` or `manifest.webmanifest`
- spans multiple files or is likely to take longer than a quick single-pass fix

Small copy edits, minor styling nits, or isolated one-line fixes do not need an ExecPlan.

## Repository Map

- `index.html`: the full app shell, including the board, toolbar buttons, drawers, dialog, and all DOM IDs used by the JavaScript.
- `app.js`: the main application module. It contains the game rules, auto-play search, rendering, event wiring, persistence, undo/redo history, and PWA registration.
- `styles.css`: all layout, responsive behavior, theme variables, drawers, board, and dialog styling.
- `sw.js`: the service worker. It caches the static assets listed in `ASSETS` and uses `CACHE_NAME` to invalidate older caches.
- `manifest.webmanifest`: install metadata for the PWA.
- `icons/`: app icons referenced by the manifest and service worker.
- `.devcontainer/devcontainer.json`: local container setup; useful when changing local workflow assumptions.

## Repo-Specific Working Rules

- Prefer small, additive changes. This project has no build step, so every change should still work as plain static files.
- Do not introduce frameworks, bundlers, or package-management-heavy tooling unless the user explicitly asks for that direction.
- If you rename or remove DOM IDs, classes, or button flows, update `index.html`, `app.js`, and `styles.css` together.
- If you change storage behavior, preserve existing saves when practical. If a breaking change is necessary, document the migration or reset path.
- If you change `sw.js`, update the cached asset list and bump `CACHE_NAME` when needed so browsers do not stay on stale assets.
- Treat localStorage and service worker changes as user-visible behavior, not implementation details. They require explicit validation.
- If you change how the app is served locally or deployed, update the relevant docs in the same pass.

## Validation Expectations

Run lightweight checks for every meaningful code change:

- `node --check app.js`
- `node --check sw.js`

Serve the repo root as static files for browser validation. In this devcontainer, the verified command is:

- `npx --yes serve@latest . -l 8080`

Useful HTTP smoke checks from the repo root:

- `curl -I http://127.0.0.1:8080/`
- `curl -I http://127.0.0.1:8080/sw.js`
- `curl -I http://127.0.0.1:8080/manifest.webmanifest`

For UI-affecting changes, manually verify the behavior in a browser:

- a new game renders and the board is interactive
- manual crossing, undo, redo, and append flows still work
- auto mode can step or run without breaking the UI
- reload keeps progress when persistence is expected
- `Reset Local Save` restores the default state when used

For PWA changes, also verify service worker registration, fresh-asset loading after a cache version bump, and offline behavior when that is part of the change.

## ExecPlan Hand-Off

When a task needs an ExecPlan, create or update a task-specific markdown plan and keep it current while the work is in progress. The plan must stay self-contained so a new contributor can restart from the working tree plus the plan alone.
