# DigitWeave repository guidance

DigitWeave is a static browser game and installable progressive web app (PWA).
Keep it deployable to plain static hosting, especially GitHub Pages, and
preserve its offline-first behavior.

## Workspace setup

- Locate the repository with `git rev-parse --show-toplevel` and inspect local
  changes with `git status --short`. Read the applicable `AGENTS.md` files,
  [README.md](README.md), and the files relevant to the task. Preserve existing
  working-tree changes.
- Check the versions of the tools the task needs. The Debian devcontainer
  supports passwordless sudo. Confirm with `sudo -n true` and use the system
  package manager to install missing task prerequisites inside the container.
  For example, run `sudo -n apt-get update` and
  `sudo -n apt-get install -y nodejs npm` when Node.js and npm are needed.
  Verify the installed tools. Keep installs local to the container unless
  the task calls for a persistent setup change.

## Repository map

- `index.html` defines the app shell, board, controls, drawers, and dialog.
- `app.js` owns the game state, auto-play, rendering, event wiring, local saves,
  undo and redo history, and service worker registration.
- `game-rules.js` contains the shared visibility, crossing, and search rules.
- `hint-worker.js` runs Hint search off the main thread.
- `styles.css` defines the board, theme, dialog, and responsive layout.
- `sw.js` controls offline caching through `ASSETS` and `CACHE_NAME`.
- `manifest.webmanifest` and `icons/` supply the PWA install metadata and icons.
- `.devcontainer/devcontainer.json` defines the local container setup.

## Execution plans

Create or update a task-specific ExecPlan before substantial work, including
gameplay or auto-play changes, save and migration changes, responsive layout
or drawer changes, PWA changes, and other work that spans multiple files or
requires multiple coordinated steps. Quick, isolated edits can use a
lightweight checklist when helpful.
Keep task plans in [docs/exec-plans/](docs/exec-plans/). Follow
[PLANS.md](PLANS.md) for the format and handoff rules.

## Subagents

- As lead, own the plan, integration, and final verification. Delegate
  independent work when it can improve speed or quality. Give each subagent
  a clear outcome, relevant context, files it may edit, and acceptance
  criteria. Assign separate write scopes for parallel edits. Ask for concise
  findings, changed files, and verification results.
- Check which models the session's subagent tool supports. The installed CLI's
  `codex debug models` command can also show its model catalog when available.
  Prefer `gpt-6-luna` for focused exploration, routine checks, or small edits.
  Prefer `gpt-6.1-terra` for screenshot review, visual reasoning, or computer
  use. Use Sol or Astra for deeper coding or cross-file reasoning.
- For unfamiliar model choices, use the `openai-docs` skill if available and
  consult the [Codex model guide](https://learn.chatgpt.com/docs/models).
  Inherit the parent model when overrides are unavailable. Work directly
  when delegation is unavailable or would add more coordination than value.

## Working rules

- Prefer small, additive changes. Keep the app build-free and use plain static
  files. Introduce frameworks, bundlers, or a package-based workflow only if
  the user asks for that direction.
- Update the relevant markup, styles, and JavaScript together when changing
  DOM IDs, classes, or button flows.
- Preserve existing saves when practical. Document the migration or reset
  path for breaking storage changes, and verify the result.
- Keep `ASSETS` current and bump `CACHE_NAME` when cached assets need to
  refresh for existing clients.
- Update the relevant documentation when local serving or deployment changes.

## Validation

For meaningful code changes, run these commands from the repository root.

```sh
node --check app.js
node --check game-rules.js
node --check hint-worker.js
node --check sw.js
```

For browser and static hosting checks, serve the repository root.

```sh
npx --yes serve@latest . -l 8080
```

While the server runs, check the required routes from another terminal.

```sh
curl -fsSI http://127.0.0.1:8080/
curl -fsSI http://127.0.0.1:8080/sw.js
curl -fsSI http://127.0.0.1:8080/manifest.webmanifest
```

- For UI changes, use a real browser or equivalent browser automation. Start
  a game and check board interaction, manual crossing, undo, redo, append,
  automatic step, run, and stop, reload persistence, and `Reset Local Save`.
  Exercise the changed behavior at the relevant viewport sizes.
- For storage changes, verify existing saves and reset in a disposable
  browser profile. For PWA changes, verify service worker registration,
  fresh assets after a cache version bump, and offline use or installability
  as applicable.
- For documentation-only changes, run `git diff --check` on the changed
  files and check local links and documented commands as appropriate.
