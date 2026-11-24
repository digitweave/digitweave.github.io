# Align repository instructions and execution plans

This ExecPlan follows [PLANS.md](../../PLANS.md).

## Purpose and acceptance

A contributor should be able to orient in DigitWeave, install missing
validation tools inside its devcontainer, delegate suitable work, and resume a
substantial task from its plan and the working tree. The two instruction files
should use a consistent Markdown style and agree about which checks to run.
Task plans should be easy to find in `docs/exec-plans/`.

## Progress

- [x] (2026-11-24 08:55 UTC) Read the repository instructions, identify
  existing changes, and delegate repository orientation and a standards review.
- [x] (2026-11-24 08:57 UTC) Update and cross-check `AGENTS.md` and `PLANS.md`.
- [x] (2026-11-24 08:57 UTC) Install validation tools and smoke-test the app.
- [x] (2026-11-24 08:58 UTC) Verify Markdown structure, local links, and change
  scope. Stop the local server.
- [x] (2026-11-24 09:00 UTC) Move both task plans to `docs/exec-plans/`, update
  the guidance and relative links, and verify the new layout.

## Surprises and discoveries

- `AGENTS.md` already contains the proposed workspace and delegation sections
  in the working tree. `.devcontainer/devcontainer.json` has a separate local
  edit with existing trailing whitespace at line 21. Node.js and npm were
  missing, and `sudo -n true` succeeded.

## Decision log

- 2026-11-24, Codex. Apply the existing root-level `EXECPLAN-*.md` convention
  so the work can be resumed from the repository without introducing a new
  directory structure.
- 2026-11-24, Codex. Keep validation commands in `AGENTS.md` and the plan
  lifecycle and template in `PLANS.md` so the two files can evolve together.
  Treat Codex's session planning tools as optional. [ExecPlan recipe](https://developers.openai.com/cookbook/articles/codex_exec_plans) · [Harness engineering](https://openai.com/index/harness-engineering/) · [Codex long-running work](https://learn.chatgpt.com/docs/long-running-work)
- 2026-11-24, Codex. Move task plans to `docs/exec-plans/` at the user's
  request to keep the repository root easy to scan. Keep the existing
  filenames and the root planning guide.

## Context and milestones

DigitWeave is a static, offline-capable browser game. `index.html` loads
`app.js`, `styles.css` styles the interface, and `sw.js` caches the app shell.
`AGENTS.md` is the entry point for project guidance. `PLANS.md` defines the
durable task plan. The prior feature is recorded in the
[collapsible empty rows ExecPlan](EXECPLAN-collapsible-empty-rows.md).

1. Read the current files and compare their planning guidance with OpenAI's
   ExecPlan, harness engineering, and Codex guidance. Preserve repository
   constraints and the in-progress workspace and delegation text.
2. Give `AGENTS.md` a concise repository map, setup and delegation guidance,
   and an authoritative list of app checks. Give `PLANS.md` a matching style,
   a reusable template with observable milestones, and guidance for handoff,
   validation evidence, and resuming work from versioned files.
3. Check Markdown structure, references, and whitespace. Install the missing
   validation tools in the devcontainer and exercise the documented baseline
   against the unmodified app. Record the observed results here.
4. Move both task plans into `docs/exec-plans/`. Update the location in
   `AGENTS.md` and `PLANS.md` and check the relocated plans and template links.

## Validation and recovery

From the repository root, run `git diff --check -- AGENTS.md PLANS.md` and
check the untracked ExecPlan for whitespace. Confirm local links resolve and
review the changed paths. For the app baseline, run `node --check app.js`
and `node --check sw.js`, then run `npx --yes serve@latest . -l 8080`. From
another terminal, request `/`, `/sw.js`, and `/manifest.webmanifest` with
`curl -fsSI` and confirm HTTP 200. The checks can be repeated. Stop the
server started by this plan when finished.

## Outcomes and retrospective

The documents now share sentence-case headings and one workflow for planning,
delegation, verification, and handoff. A `gpt-6-luna` subagent mapped the
repository while a separate subagent researched standards. Luna also reviewed
the edited documents.

- The scoped Git whitespace check and Markdown checks for relative links,
  fences, and matching template headings passed. The application files matched
  `HEAD`.
- The devcontainer now has Node.js v20.19.2 and npm 9.2.0. Both JavaScript
  syntax checks passed.
- The documented server returned HTTP 200 for the app shell, service worker,
  manifest, JavaScript, CSS, and all three icons. The served manifest parsed
  and declared the expected entry point, display mode, and icons.
- The app baseline exercised static serving. Gameplay, storage, and offline
  browser flows were outside this documentation update.
- Both task plans now live in `docs/exec-plans/`. Local links, including the
  template link from a plan's new location, resolved during verification.
